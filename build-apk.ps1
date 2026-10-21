param (
    [switch]$Release,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$PublishBase = "C:\Users\Trevor\Desktop\Other\Dugout-Pulse-Publish"
$WorkDir = "$PublishBase\.work"
$OutDir = "$PublishBase\Android-Package"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Dugout Pulse - Isolated Android Bundle  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}
if (-not (Test-Path $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
}

Write-Host "`nStaging clean source code..." -ForegroundColor Cyan
# The Android platform is generated output, deliberately excluded from the repository.
# Robocopy without /MIR leaves excluded destination folders untouched, so an old
# .work\android project can survive staging with a stale applicationId/namespace.
# Remove only that generated platform before staging; Capacitor will recreate it
# from the checked-in capacitor.config.json on this build.
$staleAndroidPlatform = Join-Path $WorkDir "android"
if (Test-Path $staleAndroidPlatform) {
    Write-Host "Removing stale generated Android platform so Capacitor recreates it from the current app config..." -ForegroundColor Yellow
    Remove-Item -LiteralPath $staleAndroidPlatform -Recurse -Force
}
$robocopyArgs = @(
    $RepoRoot,
    $WorkDir,
    "/E",
    "/XD", ".git", "node_modules", "android", "dist", "apk-output", ".gradle", ".vite"
)
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -gt 7) {
    Write-Host "Robocopy staging failed." -ForegroundColor Red
    exit 1
}

Set-Location $WorkDir

# Capacitor 7 Android dependencies require JDK 21. Check common JDK and Android Studio
# locations, including per-user installs and environment variables.
$javaCandidates = @()
foreach ($envPath in @($env:JAVA_HOME, $env:JDK_HOME, $env:ANDROID_STUDIO_JDK)) {
    if ($envPath) { $javaCandidates += $envPath }
}
$programFiles = $env:ProgramFiles
$localPrograms = Join-Path $env:LOCALAPPDATA "Programs"
$javaCandidates += @(
    "$programFiles\Eclipse Adoptium\jdk-21*",
    "$programFiles\Java\jdk-21*",
    "$programFiles\Microsoft\jdk-21*",
    "$programFiles\Android\Android Studio*\jbr",
    "$localPrograms\Android Studio*\jbr",
    "$localPrograms\Eclipse Adoptium\jdk-21*",
    "$programFiles\JetBrains\Toolbox\apps\AndroidStudio\*\*\jbr"
)
# Also discover Android Studio installations in the standard Android folder.
$androidInstallRoot = Join-Path $programFiles "Android"
if (Test-Path $androidInstallRoot) {
    $javaCandidates += Get-ChildItem -Path $androidInstallRoot -Directory -Filter "Android Studio*" -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "jbr" }
}
$selectedJavaHome = $null
$checkedJavaHomes = @()
foreach ($candidate in ($javaCandidates | Select-Object -Unique)) {
    $foundPaths = Get-Item -Path $candidate -ErrorAction SilentlyContinue
    foreach ($found in $foundPaths) {
        if (-not $found.PSIsContainer) { continue }
        $javaExe = Join-Path $found.FullName "bin\java.exe"
        if (-not (Test-Path $javaExe)) { continue }
        $checkedJavaHomes += $found.FullName
        # Windows PowerShell 5.1 can surface stderr from java -version as a
        # NativeCommandError, so capture it without terminating the script.
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $versionOutput = (& $javaExe -version 2>&1 | Out-String)
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($versionOutput -match 'version "21([."]|$)' -or $versionOutput -match 'openjdk 21') {
            $selectedJavaHome = $found.FullName
            break
        }
    }
    if ($selectedJavaHome) { break }
}
if (-not $selectedJavaHome) {
    if ($checkedJavaHomes.Count -gt 0) {
        Write-Host "Java installations checked (none were JDK 21):" -ForegroundColor Yellow
        $checkedJavaHomes | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    } else {
        Write-Host "No Java installations were found in the common JDK/Android Studio locations." -ForegroundColor Yellow
    }
    throw "JDK 21 is required for Capacitor 7 Android builds. Install JDK 21 (for example, Eclipse Temurin 21 x64), then rerun this script. Java 17 cannot compile this Android plugin."
}
$env:JAVA_HOME = $selectedJavaHome
$env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$env:PATH"
Write-Host "Using Java 21: $env:JAVA_HOME" -ForegroundColor Green

if (-not $env:ANDROID_HOME) {
    $defaultSdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
    }
}

Write-Host "Checking and synchronising npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    throw "npm dependency installation failed with exit code $LASTEXITCODE."
}

Write-Host "Building web assets..." -ForegroundColor Cyan
npm run build

npx cap sync

if (-not (Test-Path "android")) {
    Write-Host "Adding Android platform..." -ForegroundColor Yellow
    npx cap add android
}

# Complete Capacitor's platform sync BEFORE generating the custom icon/splash
# resources, so the generated artwork is the final version used by Gradle.
Write-Host "Syncing Capacitor Android platform..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "Capacitor Android sync failed with exit code $LASTEXITCODE." }

# Generate Dugout Pulse Android launcher icons and splash images.
Write-Host "Generating Dugout Pulse Android icon and splash resources..." -ForegroundColor Cyan

Add-Type -AssemblyName System.Drawing

$androidRes = Join-Path $WorkDir "android\app\src\main\res"
$iconSource = Join-Path $WorkDir "splash-source\app-icon.png"
$mobileSplash = Join-Path $WorkDir "splash-source\splash-mobile.png"
$tabletSplash = Join-Path $WorkDir "splash-source\splash-tablet.png"

foreach ($source in @($iconSource, $mobileSplash, $tabletSplash)) {
    if (-not (Test-Path $source)) {
        throw "Required image asset not found: $source"
    }
}

function New-DugoutPng {
    param (
        [string]$Source,
        [string]$Destination,
        [int]$Size,
        [bool]$AddPadding = $false
    )

    $inputImage = [System.Drawing.Image]::FromFile($Source)
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $available = if ($AddPadding) {
            [int]($Size * 0.68)
        } else {
            $Size
        }

        $scale = [Math]::Min(
            $available / $inputImage.Width,
            $available / $inputImage.Height
        )

        $width = [int][Math]::Round($inputImage.Width * $scale)
        $height = [int][Math]::Round($inputImage.Height * $scale)
        $x = [int](($Size - $width) / 2)
        $y = [int](($Size - $height) / 2)

        $graphics.DrawImage($inputImage, $x, $y, $width, $height)

        $directory = Split-Path $Destination -Parent
        if (-not (Test-Path $directory)) {
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
        }

        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        $inputImage.Dispose()
    }
}

# Legacy launcher icons for all Android screen densities.
$iconSizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $folderPath = Join-Path $androidRes $folder

    New-DugoutPng -Source $iconSource -Destination (Join-Path $folderPath "ic_launcher.png") -Size $size
    New-DugoutPng -Source $iconSource -Destination (Join-Path $folderPath "ic_launcher_round.png") -Size $size
}

# Adaptive icons for Android 8 and newer.
$drawableDir = Join-Path $androidRes "drawable-nodpi"
if (-not (Test-Path $drawableDir)) {
    New-Item -ItemType Directory -Path $drawableDir -Force | Out-Null
}

New-DugoutPng -Source $iconSource -Destination (Join-Path $drawableDir "ic_launcher_foreground.png") -Size 432 -AddPadding $true

$adaptiveDir = Join-Path $androidRes "mipmap-anydpi-v26"
if (-not (Test-Path $adaptiveDir)) {
    New-Item -ItemType Directory -Path $adaptiveDir -Force | Out-Null
}

$adaptiveXml = @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
'@

Set-Content -Path (Join-Path $adaptiveDir "ic_launcher.xml") -Value $adaptiveXml -Encoding UTF8
Set-Content -Path (Join-Path $adaptiveDir "ic_launcher_round.xml") -Value $adaptiveXml -Encoding UTF8

# Fail the build early if any launcher resource was not generated at the expected path.
$requiredIconResources = @(
    (Join-Path $androidRes "mipmap-mdpi\ic_launcher.png"),
    (Join-Path $androidRes "mipmap-hdpi\ic_launcher.png"),
    (Join-Path $androidRes "mipmap-xhdpi\ic_launcher.png"),
    (Join-Path $androidRes "mipmap-xxhdpi\ic_launcher.png"),
    (Join-Path $androidRes "mipmap-xxxhdpi\ic_launcher.png"),
    (Join-Path $adaptiveDir "ic_launcher.xml"),
    (Join-Path $drawableDir "ic_launcher_foreground.png")
)
$missingIconResources = @($requiredIconResources | Where-Object { -not (Test-Path $_) })
if ($missingIconResources.Count -gt 0) {
    throw "Launcher icon generation is incomplete. Missing: $($missingIconResources -join ', ')"
}
Write-Host "Verified generated Dugout Pulse launcher icon resources." -ForegroundColor Green

$valuesDir = Join-Path $androidRes "values"
if (-not (Test-Path $valuesDir)) {
    New-Item -ItemType Directory -Path $valuesDir -Force | Out-Null
}

# Keep the adaptive-icon background color in colors.xml only.
# Capacitor's generated ic_launcher_background.xml can duplicate this resource.
$colorsPath = Join-Path $valuesDir "colors.xml"
if (-not (Test-Path $colorsPath)) { throw "Android colors.xml was not generated: $colorsPath" }
$colorsXml = Get-Content -LiteralPath $colorsPath -Raw
if ($colorsXml -match '<color\s+name="ic_launcher_background"[^>]*>.*?</color>') {
    $colorsXml = [regex]::Replace($colorsXml, '<color\s+name="ic_launcher_background"[^>]*>.*?</color>', '<color name="ic_launcher_background">#121923</color>')
} elseif ($colorsXml -match '</resources>') {
    $colorsXml = $colorsXml -replace '</resources>', ('    <color name="ic_launcher_background">#121923</color>' + [Environment]::NewLine + '</resources>')
} else { throw "Could not add ic_launcher_background to $colorsPath" }
Set-Content -LiteralPath $colorsPath -Value $colorsXml -Encoding UTF8
$duplicateBackgroundPath = Join-Path $valuesDir "ic_launcher_background.xml"
if (Test-Path $duplicateBackgroundPath) { Remove-Item -LiteralPath $duplicateBackgroundPath -Force }
# Configure legacy splash artwork and the Android 12+ system splash screen.
Write-Host "Generating Dugout Pulse Android splash resources..." -ForegroundColor Cyan

$splashResourceDir = Join-Path $androidRes "drawable-nodpi"
if (-not (Test-Path $splashResourceDir)) { New-Item -ItemType Directory -Path $splashResourceDir -Force | Out-Null }

# Android 11 and older use the supplied splash image as the launch window background.
Copy-Item -LiteralPath $mobileSplash `
    -Destination (Join-Path $splashResourceDir "splash.png") -Force

# Android 12–14 show a centered system splash icon, not a full-screen image.
# Generate it from source artwork during the build; do not commit generated PNGs.
New-DugoutPng -Source $iconSource -Destination (Join-Path $splashResourceDir "splash_icon.png") -Size 288 -AddPadding $true

$stylesPath = Join-Path $androidRes "values\styles.xml"
if (-not (Test-Path $stylesPath)) { throw "Capacitor launch theme not found: $stylesPath" }
$styles = Get-Content -LiteralPath $stylesPath -Raw
$pattern = '(?s)<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>.*?</style>'
$match = [regex]::Match($styles, $pattern)
if (-not $match.Success) { throw "Could not find AppTheme.NoActionBarLaunch in $stylesPath" }

$launchStyle = @'
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#121923</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    <item name="android:windowBackground">@drawable/splash</item>
</style>
'@
$styles = $styles.Replace($match.Value, $launchStyle)
Set-Content -LiteralPath $stylesPath -Value $styles -Encoding UTF8

# Android 12+ prefers values-v31 resources over values/styles.xml. Apply the same
# launch theme there so Android 12–14 use the Dugout Pulse splash icon.
$stylesV31Dir = Join-Path $androidRes "values-v31"
if (-not (Test-Path $stylesV31Dir)) {
    New-Item -ItemType Directory -Path $stylesV31Dir -Force | Out-Null
}
$stylesV31Path = Join-Path $stylesV31Dir "styles.xml"
if (Test-Path $stylesV31Path) {
    $stylesV31 = Get-Content -LiteralPath $stylesV31Path -Raw
} else {
    $stylesV31 = "<?xml version=`"1.0`" encoding=`"utf-8`"?>`r`n<resources>`r`n</resources>`r`n"
}
$matchV31 = [regex]::Match($stylesV31, $pattern)
if ($matchV31.Success) {
    $stylesV31 = $stylesV31.Replace($matchV31.Value, $launchStyle)
} elseif ($stylesV31 -match '</resources>') {
    $stylesV31 = $stylesV31 -replace '</resources>', ($launchStyle + [Environment]::NewLine + '</resources>')
} else {
    throw "Could not add launch theme to $stylesV31Path"
}
Set-Content -LiteralPath $stylesV31Path -Value $stylesV31 -Encoding UTF8

foreach ($themeFile in @($stylesPath, $stylesV31Path)) {
    $themeText = Get-Content -LiteralPath $themeFile -Raw
    if ($themeText -notmatch 'name="AppTheme\.NoActionBarLaunch"') {
        throw "Launch theme is missing from $themeFile"
    }
    if ($themeText -notmatch '@drawable/splash_icon') {
        throw "Launch theme in $themeFile does not reference the generated Dugout Pulse splash icon."
    }
}
foreach ($resource in @(
    (Join-Path $splashResourceDir "splash.png"),
    (Join-Path $splashResourceDir "splash_icon.png"),
    (Join-Path $adaptiveDir "ic_launcher_round.xml"),
    (Join-Path $androidRes "mipmap-mdpi\ic_launcher_round.png")
)) {
    if (-not (Test-Path $resource)) {
        throw "Required splash or launcher resource is missing: $resource"
    }
}
Write-Host "Verified launcher and splash resources, including Android 12+ theme override." -ForegroundColor Green
Write-Host "Android launcher icons and splash resources generated." -ForegroundColor Green


# Exact game reminders need Android's Alarms & reminders permission on Android 12+.
# Android is generated inside the isolated work directory, so ensure the permission
# is present after every clean Capacitor platform generation/sync.
$manifestPath = "android\app\src\main\AndroidManifest.xml"
if (-not (Test-Path $manifestPath)) {
    throw "AndroidManifest.xml was not found after Capacitor sync: $manifestPath"
}
$manifest = Get-Content -Path $manifestPath -Raw
$manifestChanged = $false

# Point Android at the launcher icon files generated by this build script.
if ($manifest -match '<application\b[^>]*>') {
    $applicationTag = [regex]::Match($manifest, '<application\b[^>]*>').Value
    if ($applicationTag -match 'android:icon="[^"]*"') {
        $updatedApplicationTag = [regex]::Replace($applicationTag, 'android:icon="[^"]*"', 'android:icon="@mipmap/ic_launcher"')
    } else {
        $updatedApplicationTag = $applicationTag.Substring(0, $applicationTag.Length - 1) + ' android:icon="@mipmap/ic_launcher">'
    }
    if ($updatedApplicationTag -match 'android:roundIcon="[^"]*"') {
        $updatedApplicationTag = [regex]::Replace($updatedApplicationTag, 'android:roundIcon="[^"]*"', 'android:roundIcon="@mipmap/ic_launcher_round"')
    } else {
        $updatedApplicationTag = $updatedApplicationTag.Substring(0, $updatedApplicationTag.Length - 1) + ' android:roundIcon="@mipmap/ic_launcher_round">'
    }
    if ($updatedApplicationTag -ne $applicationTag) {
        $manifest = $manifest.Replace($applicationTag, $updatedApplicationTag)
        $manifestChanged = $true
    }
} else { throw "Could not find the application element in $manifestPath" }

# Explicitly declare Android 13+ notification runtime permission in the final app manifest.
if ($manifest -notmatch 'android\.permission\.POST_NOTIFICATIONS') {
    $manifest = $manifest -replace '(<manifest\b[^>]*>)', ('$1' + [Environment]::NewLine + '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />')
    $manifestChanged = $true
    Write-Host "Added POST_NOTIFICATIONS permission for Android 13+." -ForegroundColor Green
}

if ($manifest -notmatch 'android\.permission\.SCHEDULE_EXACT_ALARM') {
    $manifest = $manifest -replace '(<manifest\b[^>]*>)', ('$1' + [Environment]::NewLine + '    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />')
    $manifestChanged = $true
    Write-Host "Added SCHEDULE_EXACT_ALARM permission for Android reminders." -ForegroundColor Green
}

if ($manifestChanged) {
    Set-Content -Path $manifestPath -Value $manifest -NoNewline
}

Write-Host "Keeping Capacitor 7 Java 21 compatibility settings..." -ForegroundColor Cyan

$gradleProperties = "android\gradle.properties"
if (Test-Path $gradleProperties) {
    $props = Get-Content -Path $gradleProperties -Raw -ErrorAction SilentlyContinue
    $escapedJavaHome = $env:JAVA_HOME -replace "\\", "/"
    if ($props -match "(?m)^\s*org\.gradle\.java\.home\s*=.*$") {
        $props = [regex]::Replace($props, "(?m)^\s*org\.gradle\.java\.home\s*=.*$", "org.gradle.java.home=$escapedJavaHome")
        Set-Content -Path $gradleProperties -Value $props -NoNewline
    } else {
        Add-Content -Path $gradleProperties -Value "\`norg.gradle.java.home=$escapedJavaHome"
    }
}

foreach ($stale in @("android\app\build\intermediates\compressed_assets", "android\app\build\intermediates\merged_assets")) {
    if (Test-Path $stale) {
        Remove-Item -Path $stale -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Building Android App Bundle (AAB) with Gradle..." -ForegroundColor Cyan
Push-Location android
try {
    if ($Release) {
        .\gradlew.bat bundleRelease
        if ($LASTEXITCODE -ne 0) { throw "Gradle release bundle build failed with exit code $LASTEXITCODE." }
        $packageSource = "app\build\outputs\bundle\release\app-release.aab"
        $buildType = "release"
    } else {
        .\gradlew.bat bundleDebug
        if ($LASTEXITCODE -ne 0) { throw "Gradle debug bundle build failed with exit code $LASTEXITCODE." }
        $packageSource = "app\build\outputs\bundle\debug\app-debug.aab"
        $buildType = "debug"
    }
} finally {
    Pop-Location
}

# Include seconds so repeated builds cannot overwrite an earlier package filename within the same minute.
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$outputPackageName = "dugout-pulse-$buildType-$timestamp.aab"

$src = "android\$packageSource"
$dest = "$OutDir\$outputPackageName"

if (Test-Path $src) {
    Copy-Item $src $dest -Force
    $fileSize = (Get-Item $dest).Length / 1MB
    Write-Host "`nBUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "AAB Location: $dest ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host "`nBuild output not found at $src" -ForegroundColor Red
    exit 1
}

# For debug builds, create a WhatsApp-installable APK FROM the AAB.
# Gradle still builds the AAB; this APK is only a delivery/install artifact.
if (-not $Release) {
    Write-Host "`nPreparing WhatsApp install package from the debug AAB..." -ForegroundColor Cyan

    if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
        throw "JDK 21 was not found. Install/configure Java 21 before running bundletool."
    }

    $toolsDir = Join-Path $PublishBase "tools"
    if (-not (Test-Path $toolsDir)) {
        New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
    }

    $bundletoolJar = Join-Path $toolsDir "bundletool-all.jar"
    if (-not (Test-Path $bundletoolJar)) {
        Write-Host "Downloading Google's bundletool..." -ForegroundColor Yellow
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $releaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/google/bundletool/releases/latest" -Headers @{ "User-Agent" = "Dugout-Pulse-Build-Script" }
            $asset = $releaseInfo.assets | Where-Object { $_.name -like 'bundletool-all-*.jar' } | Select-Object -First 1
            if (-not $asset) { throw "Could not find bundletool-all JAR in the latest GitHub release." }
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $bundletoolJar -UseBasicParsing
        } catch {
            throw "Could not download bundletool. Check your internet connection and rerun. Details: $($_.Exception.Message)"
        }
    }

    $debugKeystore = Join-Path $env:USERPROFILE ".android\debug.keystore"
    if (-not (Test-Path $debugKeystore)) {
        $androidUserDir = Split-Path $debugKeystore -Parent
        New-Item -ItemType Directory -Path $androidUserDir -Force | Out-Null
        $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
        & $keytool -genkeypair -v -keystore $debugKeystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
        if ($LASTEXITCODE -ne 0) { throw "Could not create the Android debug signing key." }
    }

    $apksArchive = Join-Path $WorkDir "debug-install.apks"
    $extractDir = Join-Path $WorkDir "debug-install-apks"
    if (Test-Path $apksArchive) { Remove-Item $apksArchive -Force }
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }

    $java = Join-Path $env:JAVA_HOME "bin\java.exe"
    & $java -jar $bundletoolJar build-apks "--bundle=$dest" "--output=$apksArchive" "--mode=universal" "--ks=$debugKeystore" "--ks-pass=pass:android" "--ks-key-alias=androiddebugkey" "--key-pass=pass:android"
    if ($LASTEXITCODE -ne 0) { throw "bundletool failed to convert the debug AAB into an installable APK." }

    # Windows PowerShell 5.1 Expand-Archive only accepts a .zip extension.
    # A bundletool .apks file is ZIP-formatted, so copy it to a .zip name first.
    $apksZip = Join-Path $WorkDir "debug-install.zip"
    Copy-Item -LiteralPath $apksArchive -Destination $apksZip -Force
    Expand-Archive -LiteralPath $apksZip -DestinationPath $extractDir -Force
    $universalApk = Join-Path $extractDir "universal.apk"
    if (-not (Test-Path $universalApk)) { throw "bundletool completed, but universal.apk was not found in the output archive." }

    $whatsAppApk = Join-Path $OutDir "dugout-pulse-debug-$timestamp-whatsapp.apk"
    Copy-Item $universalApk $whatsAppApk -Force

    # Verify the actual installable APK using Android SDK build-tools.
    # Do not deliver an APK if the packaged manifest/icon entry is not as expected.
    $aaptCandidates = @()
    if ($env:ANDROID_HOME) {
        $buildToolsRoot = Join-Path $env:ANDROID_HOME "build-tools"
        if (Test-Path $buildToolsRoot) {
            $aaptCandidates += Get-ChildItem -Path $buildToolsRoot -Directory |
                Sort-Object { try { [version]$_.Name } catch { [version]"0.0" } } -Descending |
                ForEach-Object { Join-Path $_.FullName "aapt.exe" }
        }
    }
    $aaptPath = $aaptCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $aaptPath) {
        throw "Cannot verify the final APK: aapt.exe was not found under Android SDK build-tools. Refusing to deliver an unverified APK."
    }

    $badgingOutput = (& $aaptPath dump badging $whatsAppApk 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot inspect the final APK with aapt. Refusing to deliver it. Details: $badgingOutput"
    }
    # aapt dump badging uses the key "application-label", not "application: label".
    if ($badgingOutput -notmatch "application-label:'Dugout Pulse'") {
        throw "Final APK does not report the expected Dugout Pulse application label. Refusing to deliver it. Details: $badgingOutput"
    }
    # Verify the package ID too. A stale generated .work\android project previously
    # produced com.trevor.baseballhub even though capacitor.config.json specifies
    # com.trevor.dugoutpulse; do not package an APK built from stale native config.
    $expectedAppId = (Get-Content -LiteralPath (Join-Path $WorkDir "capacitor.config.json") -Raw | ConvertFrom-Json).appId
    if ([string]::IsNullOrWhiteSpace($expectedAppId) -or $badgingOutput -notmatch ("(?m)^package: name='" + [regex]::Escape($expectedAppId) + "'")) {
        throw "Final APK package ID does not match capacitor.config.json (expected '$expectedAppId'). Refusing to deliver it. Details: $badgingOutput"
    }
    # Adaptive launcher icons are reported by aapt as the XML resource path,
    # not as the legacy density-specific PNG path. Accept either valid form.
    if ($badgingOutput -notmatch "application-icon-160:'res/mipmap-anydpi-v26/ic_launcher.xml'" -and
        $badgingOutput -notmatch "application-icon-160:'res/mipmap-mdpi-v4/ic_launcher.png'" -and
        $badgingOutput -notmatch "application-icon-160:'res/mipmap-mdpi/ic_launcher.png'") {
        throw "Final APK does not expose the expected generated launcher icon (adaptive XML or legacy PNG). Refusing to deliver it. Details: $badgingOutput"
    }

    # Inspect the final APK's compiled resource table as well; source files alone
    # are not proof that the adaptive icon and its foreground made it into the APK.
    $resourceOutput = (& $aaptPath dump resources $whatsAppApk 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot inspect the final APK resource table. Refusing to deliver it. Details: $resourceOutput"
    }
    foreach ($requiredResourceName in @("ic_launcher", "ic_launcher_round", "ic_launcher_foreground", "ic_launcher_background")) {
        if ($resourceOutput -notmatch [regex]::Escape($requiredResourceName)) {
            throw "Final APK resource table is missing '$requiredResourceName'. Refusing to deliver it."
        }
    }

    # Verify the compiled manifest actually points to the generated launcher resources.
    $manifestOutput = (& $aaptPath dump xmltree $whatsAppApk "AndroidManifest.xml" 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot inspect the final APK manifest. Refusing to deliver it. Details: $manifestOutput"
    }
    if ($manifestOutput -notmatch 'android:icon\(0x01010002\)=@0x[0-9a-fA-F]+' -or
        $manifestOutput -notmatch 'android:roundIcon\(0x0101052c\)=@0x[0-9a-fA-F]+') {
        throw "Final APK manifest does not contain both launcher icon references. Refusing to deliver it."
    }

    Write-Host "Verified final APK label, launcher icon entry, compiled icon resources, and manifest references." -ForegroundColor Green

    # bundletool can package the APK with a fixed ZIP timestamp (1981/01/01).
    # Set the actual Windows file timestamps after copying the APK to the output folder.
    $apkFile = Get-Item -LiteralPath $whatsAppApk -ErrorAction Stop
    $buildTime = Get-Date
    $apkFile.LastWriteTime = $buildTime
    $apkFile.CreationTime = $buildTime
    $apkFile.LastAccessTime = $buildTime

    # Read back the filesystem timestamp so the build log confirms the applied value.
    $apkFile.Refresh()
    Write-Host "APK file modified: $($apkFile.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
    $apkSize = (Get-Item $whatsAppApk).Length / 1MB
    Write-Host "WhatsApp install APK: $whatsAppApk ($([math]::Round($apkSize, 2)) MB)" -ForegroundColor Green
    Write-Host "Send the *whatsapp.apk file to your phone via WhatsApp, then tap it to install." -ForegroundColor Cyan
}

if ($Install) {
    Write-Host "AABs cannot be installed directly with adb. For debug builds, use the generated WhatsApp APK shown above." -ForegroundColor Yellow
}

Set-Location $RepoRoot
Write-Host "Done!" -ForegroundColor Cyan