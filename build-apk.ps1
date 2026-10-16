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

if (-not $env:JAVA_HOME) {
    $defaultJdkPaths = @(
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    foreach ($path in $defaultJdkPaths) {
        $found = Get-Item $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $env:JAVA_HOME = $found.FullName
            break
        }
    }
}

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

if (-not (Test-Path "android")) {
    Write-Host "Adding Android platform..." -ForegroundColor Yellow
    npx cap add android
}

Write-Host "Syncing Capacitor..." -ForegroundColor Cyan
npx cap sync android

Write-Host "Applying Java 17 compatibility..." -ForegroundColor Cyan
$gradleFiles = Get-ChildItem -Path "android" -Recurse -File -Include "*.gradle","*.gradle.kts" -ErrorAction SilentlyContinue
foreach ($file in $gradleFiles) {
    try {
        $raw = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($raw) {
            $orig = $raw
            $raw = $raw -replace "JavaVersion\.VERSION_21", "JavaVersion.VERSION_17"
            $raw = $raw -replace "JavaVersion\.VERSION_22", "JavaVersion.VERSION_17"
            $raw = $raw -replace "VERSION_21", "VERSION_17"
            $raw = $raw -replace "VERSION_22", "VERSION_17"
            $raw = $raw -replace "jvmTarget = '21'", "jvmTarget = '17'"
            $raw = $raw -replace "sourceCompatibility = 21", "sourceCompatibility = 17"
            $raw = $raw -replace "targetCompatibility = 21", "targetCompatibility = 17"
            if ($raw -ne $orig) {
                Set-Content -Path $file.FullName -Value $raw -NoNewline
            }
        }
    } catch {}
}

$gradleProperties = "android\gradle.properties"
if (Test-Path $gradleProperties) {
    $props = Get-Content -Path $gradleProperties -Raw -ErrorAction SilentlyContinue
    if (-not ($props -match "org.gradle.java.home")) {
        $escapedJavaHome = $env:JAVA_HOME -replace "\\", "/"
        Add-Content -Path $gradleProperties -Value "`norg.gradle.java.home=$escapedJavaHome"
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

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
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
        throw "Java 17 was not found. Install/configure Java 17 before running bundletool."
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

    Expand-Archive -LiteralPath $apksArchive -DestinationPath $extractDir -Force
    $universalApk = Join-Path $extractDir "universal.apk"
    if (-not (Test-Path $universalApk)) { throw "bundletool completed, but universal.apk was not found in the output archive." }

    $whatsAppApk = Join-Path $OutDir "dugout-pulse-debug-$timestamp-whatsapp.apk"
    Copy-Item $universalApk $whatsAppApk -Force
    $apkSize = (Get-Item $whatsAppApk).Length / 1MB
    Write-Host "WhatsApp install APK: $whatsAppApk ($([math]::Round($apkSize, 2)) MB)" -ForegroundColor Green
    Write-Host "Send the *whatsapp.apk file to your phone via WhatsApp, then tap it to install." -ForegroundColor Cyan
}

if ($Install) {
    Write-Host "AABs cannot be installed directly with adb. For debug builds, use the generated WhatsApp APK shown above." -ForegroundColor Yellow
}

Set-Location $RepoRoot
Write-Host "Done!" -ForegroundColor Cyan