param (
    [switch]$Release,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$PublishBase = "C:\Users\Trevor\Desktop\Other\Dugout-Pulse-Publish"
$WorkDir = "$PublishBase\.work"
$OutDir = "$PublishBase\Android-Package"
# The application ID of the already-installed Dugout Pulse app. Never change this.
$ExpectedApplicationId = "com.trevor.dugoutpulse"

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

# Application identity: the existing installed app is com.trevor.dugoutpulse. The build
# stops if the staged config, or the generated Android project, would produce any other
# application ID. Nothing here changes the ID; it only refuses to build a different one.
$stagedConfigPath = Join-Path $WorkDir "capacitor.config.json"
if (-not (Test-Path -LiteralPath $stagedConfigPath)) { throw "capacitor.config.json was not found in $WorkDir." }
$stagedAppId = (Get-Content -LiteralPath $stagedConfigPath -Raw | ConvertFrom-Json).appId
if ($stagedAppId -ne $ExpectedApplicationId) {
    throw "capacitor.config.json appId is '$stagedAppId' but the existing Dugout Pulse application is '$ExpectedApplicationId'. Refusing to build an app with a different identity."
}
Write-Host "Application ID: $stagedAppId" -ForegroundColor Green

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

# The isolated Android platform was removed above to eliminate stale native
# configuration. Add it from the current Capacitor config, then sync it once.
if (-not (Test-Path "android")) {
    Write-Host "Adding fresh Android platform from capacitor.config.json..." -ForegroundColor Yellow
    npx cap add android
    if ($LASTEXITCODE -ne 0) { throw "Capacitor failed to create the Android platform (exit code $LASTEXITCODE)." }
}

# Complete Capacitor's platform sync BEFORE generating the custom icon/splash
# resources, so the generated artwork is the final version used by Gradle.
Write-Host "Syncing Capacitor Android platform..." -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "Capacitor Android sync failed with exit code $LASTEXITCODE." }

# Confirm the generated Android project carries the same application ID, and has no
# applicationIdSuffix (a suffix, e.g. ".debug", would make Android treat it as another app).
$appGradlePath = Join-Path $WorkDir "android\app\build.gradle"
if (Test-Path -LiteralPath $appGradlePath) {
    $appGradle = Get-Content -LiteralPath $appGradlePath -Raw
    $gradleAppId = [regex]::Match($appGradle, "(?m)^\s*applicationId\s*=?\s*[`"']([^`"']+)[`"']")
    if ($gradleAppId.Success -and $gradleAppId.Groups[1].Value -ne $ExpectedApplicationId) {
        throw "Generated android/app/build.gradle applicationId is '$($gradleAppId.Groups[1].Value)', expected '$ExpectedApplicationId'."
    }
    if ($appGradle -match "(?m)^\s*applicationIdSuffix\b") {
        throw "Generated android/app/build.gradle sets an applicationIdSuffix, which would install as a different app."
    }
    if (-not $gradleAppId.Success) {
        Write-Host "Could not read applicationId from build.gradle; the final APK package check will still be enforced." -ForegroundColor Yellow
    }
} else {
    Write-Host "android\app\build.gradle not found for the identity check; the final APK package check will still be enforced." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Dugout Pulse launcher icon and splash generation.
# The images in splash-source\ are the ORIGINAL artwork. They are only ever read;
# every Android-specific size, crop and format below is generated from them during
# the build, straight into the disposable .work\android project.
# ---------------------------------------------------------------------------
Write-Host "Generating Dugout Pulse Android icon and splash resources..." -ForegroundColor Cyan

Add-Type -AssemblyName System.Drawing

$androidRes = Join-Path $WorkDir "android\app\src\main\res"
$sourceDir = Join-Path $WorkDir "splash-source"
$iconSource = Join-Path $sourceDir "app-icon.png"
$mobileSplash = Join-Path $sourceDir "splash-mobile.png"
$tabletSplash = Join-Path $sourceDir "splash-tablet.png"

# The large-screen splash original. If your file uses a different name, set it here
# (file name only, inside splash-source\); otherwise common names are tried.
$largeSplashName = $null
$largeSplash = $null
if ($largeSplashName) {
    $largeSplash = Join-Path $sourceDir $largeSplashName
} else {
    foreach ($candidateName in @("splash-large.png", "splash-desktop.png", "splash-large-screen.png", "splash-largescreen.png", "splash-xlarge.png", "splash-wide.png")) {
        $candidatePath = Join-Path $sourceDir $candidateName
        if (Test-Path -LiteralPath $candidatePath) { $largeSplash = $candidatePath; break }
    }
}
if (-not $largeSplash -or -not (Test-Path -LiteralPath $largeSplash)) {
    $present = @(Get-ChildItem -LiteralPath $sourceDir -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join ", "
    throw "Large-screen splash original not found in $sourceDir (files present: $present). Set `$largeSplashName in build-apk.ps1 to its file name."
}

foreach ($source in @($iconSource, $mobileSplash, $tabletSplash, $largeSplash)) {
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Required image asset not found: $source"
    }
}

# Resize one original into one Android resource PNG.
#   Contain: whole image fits inside the target (icons).
#   Cover:   image fills the whole target, overflow is cropped (full-screen splash).
#   Scale:   fraction of the target the image may occupy (adaptive-icon safe zone).
#   Circle:  clip to a circle (round launcher icon).
function Save-DugoutImage {
    param (
        [string]$Source,
        [string]$Destination,
        [int]$Width,
        [int]$Height,
        [ValidateSet("Contain", "Cover")][string]$Mode = "Contain",
        [double]$Scale = 1.0,
        [switch]$Circle,
        [switch]$Jpeg,
        [int]$JpegQuality = 82,
        [string]$BackgroundHex = ""
    )

    $inputImage = [System.Drawing.Image]::FromFile($Source)
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $clipPath = $null

    try {
        # FORCE the canvas resolution to match the input file's DPI precisely.
        # This completely neutralizes Windows monitor scaling artifacts.
        $bitmap.SetResolution($inputImage.HorizontalResolution, $inputImage.VerticalResolution)

        $graphics.Clear([System.Drawing.Color]::Transparent)
        if ($BackgroundHex) { $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($BackgroundHex)) }
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        if ($Circle) {
            $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
            $clipPath.AddEllipse(0, 0, $Width, $Height)
            $graphics.SetClip($clipPath)
        }

        $availableWidth = $Width * $Scale
        $availableHeight = $Height * $Scale
        $ratioX = $availableWidth / $inputImage.Width
        $ratioY = $availableHeight / $inputImage.Height
        if ($Mode -eq "Cover") { $ratio = [Math]::Max($ratioX, $ratioY) } else { $ratio = [Math]::Min($ratioX, $ratioY) }

        $drawWidth = $inputImage.Width * $ratio
        $drawHeight = $inputImage.Height * $ratio
        $drawX = ($Width - $drawWidth) / 2
        $drawY = ($Height - $drawHeight) / 2

        $graphics.DrawImage($inputImage, [single]$drawX, [single]$drawY, [single]$drawWidth, [single]$drawHeight)

        $directory = Split-Path $Destination -Parent
        if (-not (Test-Path $directory)) {
            New-Item -ItemType Directory -Path $directory -Force | Out-Null
        }

        if ($Jpeg) {
            # Full-screen splash images have no transparency, and JPEG is far smaller
            # than PNG for artwork of this size. Android loads .jpg drawables natively.
            $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
            $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$JpegQuality)
            try { $bitmap.Save($Destination, $jpegCodec, $encoderParams) } finally { $encoderParams.Dispose() }
        } else {
            $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
        }
    }
    finally {
        if ($clipPath) { $clipPath.Dispose() }
        $graphics.Dispose()
        $bitmap.Dispose()
        $inputImage.Dispose()
    }
}

# Average colour of the artwork's outer edge, as #RRGGBB, read straight from the
# original pixels. Returns $null for artwork with transparency so the default colour
# below is kept. (Do not resample first: GDI+ bicubic scaling blends the border with
# transparent pixels, which made every image look transparent and forced the blue
# fallback colour into the system splash and the letterbox fill.)
function Get-DugoutEdgeColorHex {
    param ([string]$Source)

    $sourceImage = New-Object System.Drawing.Bitmap($Source)
    try {
        $lastX = $sourceImage.Width - 1
        $lastY = $sourceImage.Height - 1
        $red = 0; $green = 0; $blue = 0; $count = 0; $transparent = $false
        $steps = 64
        for ($i = 0; $i -le $steps; $i++) {
            $x = [int][Math]::Round($lastX * $i / $steps)
            $y = [int][Math]::Round($lastY * $i / $steps)
            foreach ($point in @(@($x, 0), @($x, $lastY), @(0, $y), @($lastX, $y))) {
                $pixel = $sourceImage.GetPixel($point[0], $point[1])
                if ($pixel.A -lt 255) { $transparent = $true }
                $red += $pixel.R; $green += $pixel.G; $blue += $pixel.B; $count++
            }
        }
        if ($transparent -or $count -eq 0) { return $null }
        return ("#{0:X2}{1:X2}{2:X2}" -f [int][Math]::Round($red / $count), [int][Math]::Round($green / $count), [int][Math]::Round($blue / $count))
    }
    finally {
        $sourceImage.Dispose()
    }
}

# Remove Capacitor's template splash and launcher resources first. The template ships
# density-specific splash.png / ic_launcher*.png files, plus drawable-v24 and
# drawable XML icon layers. Android prefers the most specific matching qualifier, so
# any of them left behind could override the Dugout Pulse resources generated below.
$templateResourcePattern = '^(splash|splash_icon|ic_launcher.*)$'
foreach ($resDir in @(Get-ChildItem -LiteralPath $androidRes -Directory | Where-Object { $_.Name -match '^(drawable|mipmap)' })) {
    foreach ($templateFile in @(Get-ChildItem -LiteralPath $resDir.FullName -File | Where-Object { $_.BaseName -match $templateResourcePattern })) {
        Remove-Item -LiteralPath $templateFile.FullName -Force
    }
}

# Launcher icons. Source: app-icon.png.
# Do not add a second circle/rounded-square frame around the supplied artwork.
# Legacy icons use the source artwork edge-to-edge; Android/launcher handles the icon shape.
# Adaptive icons use the same artwork as a foreground layer over the brand background.
$densities = [ordered]@{ "mdpi" = 1.0; "hdpi" = 1.5; "xhdpi" = 2.0; "xxhdpi" = 3.0; "xxxhdpi" = 4.0 }

foreach ($density in $densities.Keys) {
    $multiplier = [double]$densities[$density]
    $folderPath = Join-Path $androidRes "mipmap-$density"
    $legacySize = [int][Math]::Round(48 * $multiplier)
    $adaptiveSize = [int][Math]::Round(108 * $multiplier)

    # Keep all important artwork inside the launcher mask's safe area. Do not clip
    # the round icon to a circle in the source bitmap: Android applies its own mask,
    # and pre-clipping the source cuts off artwork at the top, bottom and sides.
    Save-DugoutImage -Source $iconSource -Destination (Join-Path $folderPath "ic_launcher.png") -Width $legacySize -Height $legacySize -Scale 1.0
    Save-DugoutImage -Source $iconSource -Destination (Join-Path $folderPath "ic_launcher_round.png") -Width $legacySize -Height $legacySize -Scale 1.0
    
    # 2. For the Adaptive Foreground Layer, force it to run full bleed edge-to-edge (Scale 1.0)
    # This ensures your dark teal background completely floods the Android circular mask window.
    Save-DugoutImage -Source $iconSource -Destination (Join-Path $folderPath "ic_launcher_foreground.png") -Width $adaptiveSize -Height $adaptiveSize -Scale 1.0
}

$adaptiveDir = Join-Path $androidRes "mipmap-anydpi-v26"
if (-not (Test-Path $adaptiveDir)) {
    New-Item -ItemType Directory -Path $adaptiveDir -Force | Out-Null
}

$adaptiveXml = @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $adaptiveDir "ic_launcher.xml"), $adaptiveXml, $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $adaptiveDir "ic_launcher_round.xml"), $adaptiveXml, $utf8NoBom)

# Fail the build early if any launcher resource was not generated at the expected path.
$requiredIconResources = @(
    (Join-Path $adaptiveDir "ic_launcher.xml"),
    (Join-Path $adaptiveDir "ic_launcher_round.xml")
)
foreach ($density in $densities.Keys) {
    foreach ($iconFile in @("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png")) {
        $requiredIconResources += (Join-Path $androidRes "mipmap-$density\$iconFile")
    }
}
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
# A freshly generated Capacitor Android project may not contain colors.xml, so
# create a valid values resource file instead of failing on a missing optional file.
$colorsPath = Join-Path $valuesDir "colors.xml"
if (Test-Path $colorsPath) {
    $colorsXml = Get-Content -LiteralPath $colorsPath -Raw
    if ($colorsXml -match '<color\s+name="ic_launcher_background"[^>]*>.*?</color>') {
        $colorsXml = [regex]::Replace($colorsXml, '<color\s+name="ic_launcher_background"[^>]*>.*?</color>', '<color name="ic_launcher_background">#121923</color>')
    } elseif ($colorsXml -match '</resources>') {
        $colorsXml = $colorsXml -replace '</resources>', ('    <color name="ic_launcher_background">#121923</color>' + [Environment]::NewLine + '</resources>')
    } else { throw "Could not add ic_launcher_background to existing $colorsPath" }
} else {
    $colorsXml = @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#121923</color>
</resources>
'@
}
Set-Content -LiteralPath $colorsPath -Value $colorsXml -Encoding UTF8
$duplicateBackgroundPath = Join-Path $valuesDir "ic_launcher_background.xml"
if (Test-Path $duplicateBackgroundPath) { Remove-Item -LiteralPath $duplicateBackgroundPath -Force }
# Configure legacy splash artwork and the Android 12+ system splash screen.
Write-Host "Generating Dugout Pulse Android splash resources..." -ForegroundColor Cyan

# Android 11 and older use drawable/splash as the launch window background, so the
# three original splash images are cropped (cover) into per-device-class resources.
# Qualifiers: sw600dp = tablets, sw720dp = large screens, long = tall phones,
# port/land = orientation. nodpi keeps Android from rescaling the generated pixels.
# Anything not matched by a more specific folder falls back to drawable-nodpi\splash.jpg.
#
# APK size: every variant below ships inside the package, so they are kept modest
# (JPEG, 720p-class phones, ~1200-1500px tablets) and the portrait fallback doubles as
# the default phone portrait image instead of being duplicated.
$splashTargets = @(
    @{ Dir = "drawable-nodpi";                  Source = $mobileSplash; Width = 720;  Height = 1280; Mode = "Cover"   },
    @{ Dir = "drawable-land-nodpi";             Source = $mobileSplash; Width = 1280; Height = 720;  Mode = "Contain" },
    @{ Dir = "drawable-long-port-nodpi";        Source = $mobileSplash; Width = 720;  Height = 1600; Mode = "Cover"   },
    @{ Dir = "drawable-long-land-nodpi";        Source = $mobileSplash; Width = 1600; Height = 720;  Mode = "Contain" },
    @{ Dir = "drawable-sw600dp-port-nodpi";     Source = $tabletSplash; Width = 1200; Height = 1920; Mode = "Cover"   },
    @{ Dir = "drawable-sw600dp-land-nodpi";     Source = $tabletSplash; Width = 1920; Height = 1200; Mode = "Contain" },
    @{ Dir = "drawable-sw720dp-port-nodpi";     Source = $largeSplash;  Width = 1440; Height = 2304; Mode = "Contain" },
    @{ Dir = "drawable-sw720dp-land-nodpi";     Source = $largeSplash;  Width = 2304; Height = 1440; Mode = "Contain" }
)
# Fit rules, chosen from the shape of the three originals (phone 1:2 portrait, tablet 3:4
# portrait, large screen 1:1 square):
#   Cover   - the artwork fills the screen; only used where the screen shape is close to
#             the artwork's shape, so just a thin edge is trimmed.
#   Contain - the whole artwork is kept, centred, and the remaining space is filled with
#             the artwork's own edge colour (black), so nothing important is ever cropped
#             (landscape screens, and the square large-screen art on any screen).
$splashFillColors = @{}
$splashResourceDir = Join-Path $androidRes "drawable-nodpi"
foreach ($target in $splashTargets) {
    if (-not $splashFillColors.ContainsKey($target.Source)) {
        $fillColor = Get-DugoutEdgeColorHex -Source $target.Source
        if (-not $fillColor) { $fillColor = "#121923" }
        $splashFillColors[$target.Source] = $fillColor
    }
    $splashDestination = Join-Path (Join-Path $androidRes $target.Dir) "splash.jpg"
    Save-DugoutImage -Source $target.Source -Destination $splashDestination -Width $target.Width -Height $target.Height -Mode $target.Mode -BackgroundHex $splashFillColors[$target.Source] -Jpeg
}

# Android 12-14 show a centred system splash icon on the splash background colour,
# not a full-screen image. The icon sits inside a circular mask (about two thirds of
# the canvas), so the artwork is scaled into that area.
Save-DugoutImage -Source $iconSource -Destination (Join-Path $splashResourceDir "splash_icon.png") -Width 576 -Height 576 -Scale (2.0 / 3.0)

$missingSplashResources = @($splashTargets | ForEach-Object { Join-Path (Join-Path $androidRes $_.Dir) "splash.jpg" } | Where-Object { -not (Test-Path $_) })
if ($missingSplashResources.Count -gt 0) {
    throw "Splash generation is incomplete. Missing: $($missingSplashResources -join ', ')"
}

$stylesPath = Join-Path $androidRes "values\styles.xml"
if (-not (Test-Path $stylesPath)) { throw "Capacitor launch theme not found: $stylesPath" }
$styles = Get-Content -LiteralPath $stylesPath -Raw
$pattern = '(?s)<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>.*?</style>'
$match = [regex]::Match($styles, $pattern)
if (-not $match.Success) { throw "Could not find AppTheme.NoActionBarLaunch in $stylesPath" }

# Android 12+ always shows a system splash first, and it can only show a background
# colour plus a centred icon - never a full-screen image. Capacitor 7's BridgeActivity
# then switches the activity to AppTheme.NoActionBar (hard-coded in its onCreate), so
# whatever window background THAT theme has is what appears the moment the system
# splash leaves. The sequence is therefore built like this:
#   1. System splash: use the edge colour sampled from the actual mobile splash artwork
#      and a transparent icon, so Android's unavoidable system splash blends into the
#      first full-screen artwork instead of flashing the unrelated blue app background.
#      It is only shown until the activity's first frame (see "Native splash handoff").
#   2. AppTheme.NoActionBar gets the generated, device-matched splash artwork as its
#      window background, so the artwork is already on screen when the system splash
#      leaves, with no plain screen in between.
# Do not show a centred app icon on Android 12+. The full-screen, device-matched
# splash artwork is the launch experience; use a transparent system icon during
# the brief native handoff so the centred icon does not appear as a separate screen.
$showSystemSplashIcon = $false
$systemSplashIcon = "@drawable/splash_icon_blank"

# Android 12+ requires a system splash background colour. Match it to the actual
# splash artwork edge, not the app's blue brand background, to avoid a blue flash.
$systemSplashBackground = $splashFillColors[$mobileSplash]
if (-not $systemSplashBackground) { $systemSplashBackground = "#000000" }
Write-Host "System splash background colour: $systemSplashBackground" -ForegroundColor Cyan

$blankIconXml = @'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <size android:width="1dp" android:height="1dp"/>
    <solid android:color="@android:color/transparent"/>
</shape>
'@
$blankIconDir = Join-Path $androidRes "drawable"
if (-not (Test-Path $blankIconDir)) { New-Item -ItemType Directory -Path $blankIconDir -Force | Out-Null }
[System.IO.File]::WriteAllText((Join-Path $blankIconDir "splash_icon_blank.xml"), $blankIconXml, (New-Object System.Text.UTF8Encoding($false)))

$launchStyle = @'
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">__SYSTEM_SPLASH_BACKGROUND__</item>
    <item name="windowSplashScreenAnimatedIcon">__SYSTEM_SPLASH_ICON__</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    <item name="android:windowBackground">@drawable/splash</item>
__SPLASH_BAR_ITEMS__
</style>
'@
# Status and navigation bars take the artwork's edge colour (with light icons) so
# the launch screen reads as one full-screen image, as in other apps' launch screens.
$splashBarItems = @'
    <item name="android:statusBarColor">__SYSTEM_SPLASH_BACKGROUND__</item>
    <item name="android:navigationBarColor">__SYSTEM_SPLASH_BACKGROUND__</item>
    <item name="android:windowLightStatusBar">false</item>
    <item name="android:windowLightNavigationBar">false</item>
    <item name="android:enforceNavigationBarContrast">false</item>
'@
$splashBarItems = $splashBarItems.TrimEnd()
$splashBarItemPattern = '\s*<item\s+name="android:(statusBarColor|navigationBarColor|windowLightStatusBar|windowLightNavigationBar|enforceNavigationBarContrast)">[^<]*</item>'
$launchStyle = $launchStyle.Replace("__SPLASH_BAR_ITEMS__", $splashBarItems)
$launchStyle = $launchStyle.Replace("__SYSTEM_SPLASH_BACKGROUND__", $systemSplashBackground).Replace("__SYSTEM_SPLASH_ICON__", $systemSplashIcon)
$styles = $styles.Replace($match.Value, $launchStyle)

# Give the theme the activity actually ends up with the splash artwork as its window
# background. Only the window background item is added; every other item is kept.
$noActionBarPattern = '(?s)(<style\s+name="AppTheme\.NoActionBar"[^>]*>)(.*?)(</style>)'
$noActionBarMatch = [regex]::Match($styles, $noActionBarPattern)
if (-not $noActionBarMatch.Success) { throw "Could not find AppTheme.NoActionBar in $stylesPath" }
$noActionBarBody = [regex]::Replace($noActionBarMatch.Groups[2].Value, '\s*<item\s+name="android:windowBackground">[^<]*</item>', '')
$noActionBarBody = [regex]::Replace($noActionBarBody, $splashBarItemPattern, '')
$noActionBarNew = $noActionBarMatch.Groups[1].Value + $noActionBarBody.TrimEnd() + [Environment]::NewLine + '    <item name="android:windowBackground">@drawable/splash</item>' + [Environment]::NewLine + $splashBarItems.Replace("__SYSTEM_SPLASH_BACKGROUND__", $systemSplashBackground) + [Environment]::NewLine + $noActionBarMatch.Groups[3].Value
$styles = $styles.Replace($noActionBarMatch.Value, $noActionBarNew)
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

# Android 12+ resolves AppTheme.NoActionBar from values-v31, not values/styles.xml.
# Give that actual post-splash theme the same full-screen artwork window background;
# otherwise the system splash disappears into a plain WebView/window before React loads.
$noActionBarV31Match = [regex]::Match($stylesV31, $noActionBarPattern)
if ($noActionBarV31Match.Success) {
    # Only patch this theme when the v31 resource file defines its own override.
    # If it does not, Android inherits AppTheme.NoActionBar from values/styles.xml,
    # which was already patched above. Do not fail a valid generated project.
    $noActionBarV31Body = [regex]::Replace($noActionBarV31Match.Groups[2].Value, '\s*<item\s+name="android:windowBackground">[^<]*</item>', '')
    $noActionBarV31Body = [regex]::Replace($noActionBarV31Body, $splashBarItemPattern, '')
    $noActionBarV31New = $noActionBarV31Match.Groups[1].Value + $noActionBarV31Body.TrimEnd() + [Environment]::NewLine + '    <item name="android:windowBackground">@drawable/splash</item>' + [Environment]::NewLine + $splashBarItems.Replace("__SYSTEM_SPLASH_BACKGROUND__", $systemSplashBackground) + [Environment]::NewLine + $noActionBarV31Match.Groups[3].Value
    $stylesV31 = $stylesV31.Replace($noActionBarV31Match.Value, $noActionBarV31New)
}

# Persist the v31 launch theme even when the generated Capacitor project did not
# already contain values-v31/styles.xml. Otherwise the new theme exists only in
# memory, Android falls back to values/styles.xml, and the intended v31 resources
# are never actually applied on Android 12+.
Set-Content -LiteralPath $stylesV31Path -Value $stylesV31 -Encoding UTF8

# Both theme files are written above, including a new values-v31/styles.xml
# when the generated Capacitor project did not provide one.
$themeFilesToValidate = @($stylesPath, $stylesV31Path)
foreach ($themeFile in $themeFilesToValidate) {
    $themeText = Get-Content -LiteralPath $themeFile -Raw
    if ($themeText -notmatch 'name="AppTheme\.NoActionBarLaunch"') {
        throw "Launch theme is missing from $themeFile"
    }
    if ($themeText -notmatch '@drawable/splash_icon') {
        throw "Launch theme in $themeFile does not reference the generated Dugout Pulse splash icon."
    }
}
foreach ($resource in @(
    (Join-Path $splashResourceDir "splash.jpg"),
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

# ---------------------------------------------------------------------------
# Native splash handoff.
# Keep Capacitor MainActivity as the launcher; do not add a separate SplashActivity
# or fixed timer. The launch sequence is:
#   1. Android 12+ only: the mandatory system splash (edge colour, no icon) until the
#      activity draws its first frame. The SplashScreen plugin must not hold it
#      (capacitor.config.json: launchShowDuration 0); holding it kept this plain
#      colour on screen for the whole WebView start-up.
#   2. The activity window background (@drawable/splash, device-matched artwork),
#      seen through the transparent WebView while the web app loads. The page stays
#      transparent and renders nothing until stored data has loaded and the splash
#      has been visible for at least 1.2 seconds (index.html, App.tsx), so there is
#      no second, web-drawn splash.
#   3. The app, which paints its own opaque background in its first frame.
# ---------------------------------------------------------------------------

$assetConfigPath = "android\app\src\main\assets\capacitor.config.json"
if (-not (Test-Path -LiteralPath $assetConfigPath)) {
    throw "Generated capacitor.config.json was not found in android assets; cannot verify the native splash handoff."
}
$assetConfig = Get-Content -LiteralPath $assetConfigPath -Raw | ConvertFrom-Json
# Capacitor reads backgroundColor as #RRGGBBAA; fully transparent lets the native
# splash artwork show through the WebView until the page paints the app.
if ($assetConfig.backgroundColor -ne "#00000000") {
    throw "Generated capacitor.config.json backgroundColor is '$($assetConfig.backgroundColor)', expected '#00000000' (transparent WebView over the native splash artwork). Check capacitor.config.json."
}
if ($assetConfig.plugins.SplashScreen.launchShowDuration -ne 0) {
    throw "Generated capacitor.config.json SplashScreen.launchShowDuration must be 0 so the plugin does not hold the plain Android 12+ system splash over the native splash artwork."
}
Write-Host "Verified transparent WebView and unheld system splash for the native splash handoff." -ForegroundColor Green


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

    # Verify the splash resources and the tablet / large-screen splash variants were compiled in.
    foreach ($requiredSplashToken in @("drawable/splash", "drawable/splash_icon", "mipmap/ic_launcher_foreground", "sw600dp", "sw720dp")) {
        if ($resourceOutput -notmatch [regex]::Escape($requiredSplashToken)) {
            throw "Final APK resource table is missing '$requiredSplashToken'. Refusing to deliver it."
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

    # Capacitor's MainActivity is the launcher. SplashScreen is a native plugin
    # managed by that activity; there must not be a separate SplashActivity.
    if ($badgingOutput -notmatch "launchable-activity: name='[^']*MainActivity'") {
        throw "Final APK does not declare Capacitor MainActivity as its launcher. Refusing to deliver it. Details: $badgingOutput"
    }
    if ($manifestOutput -notmatch 'MainActivity') {
        throw "Final APK manifest does not contain Capacitor MainActivity. Refusing to deliver it."
    }
    if ($manifestOutput -match 'SplashActivity') {
        throw "Final APK unexpectedly contains a separate SplashActivity. Refusing to deliver it."
    }

    Write-Host "Verified final APK label, launcher icon entry, compiled icon resources, and MainActivity manifest references." -ForegroundColor Green

    # --- Application identity guard -------------------------------------------------
    # The APK must be the SAME application as the one already installed: same package
    # ID and same signing certificate as the previous package, otherwise Android either
    # installs it as a second app (different ID) or rejects the update (different key).
    # These are read-only checks; nothing here changes the application's identity.
    $apksignerPath = $null
    $apksignerCandidate = Join-Path (Split-Path $aaptPath -Parent) "apksigner.bat"
    if (Test-Path $apksignerCandidate) {
        $apksignerPath = $apksignerCandidate
    } else {
        Write-Host "apksigner.bat was not found next to aapt; the signing certificate cannot be compared." -ForegroundColor Yellow
    }

    function Get-ApkIdentity {
        param ([string]$ApkPath)

        $badging = (& $aaptPath dump badging $ApkPath 2>&1 | Out-String)
        $packageMatch = [regex]::Match($badging, "(?m)^package: name='([^']+)'")
        $versionMatch = [regex]::Match($badging, "versionCode='(\d+)'\s+versionName='([^']*)'")
        $certDigest = $null
        if ($apksignerPath) {
            $previousPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = "Continue"
                $signerOutput = (& $apksignerPath verify --print-certs $ApkPath 2>&1 | Out-String)
            } finally {
                $ErrorActionPreference = $previousPreference
            }
            $certMatch = [regex]::Match($signerOutput, "certificate SHA-256 digest:\s*([0-9a-fA-F]+)")
            if ($certMatch.Success) { $certDigest = $certMatch.Groups[1].Value.ToLower() }
        }
        [pscustomobject]@{
            Package     = $packageMatch.Groups[1].Value
            VersionCode = $versionMatch.Groups[1].Value
            VersionName = $versionMatch.Groups[2].Value
            Cert        = $certDigest
        }
    }

    $newIdentity = Get-ApkIdentity -ApkPath $whatsAppApk
    Write-Host "APK identity: package=$($newIdentity.Package) versionCode=$($newIdentity.VersionCode) versionName=$($newIdentity.VersionName)" -ForegroundColor Cyan
    Write-Host "APK signing certificate (SHA-256): $($newIdentity.Cert)" -ForegroundColor Cyan

    if ($newIdentity.Package -ne $ExpectedApplicationId) {
        Remove-Item -LiteralPath $whatsAppApk -Force -ErrorAction SilentlyContinue
        throw "Final APK package ID is '$($newIdentity.Package)' but the existing Dugout Pulse application is '$ExpectedApplicationId'. Installing it would create a second app. APK removed."
    }

    $newApkName = Split-Path $whatsAppApk -Leaf
    $previousApks = @(Get-ChildItem -LiteralPath $OutDir -Filter "*.apk" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne $newApkName } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 3)
    $comparedWithPrevious = $false
    foreach ($previousApk in $previousApks) {
        $previousIdentity = Get-ApkIdentity -ApkPath $previousApk.FullName
        Write-Host "Previous APK $($previousApk.Name): package=$($previousIdentity.Package) versionCode=$($previousIdentity.VersionCode) cert=$($previousIdentity.Cert)" -ForegroundColor DarkCyan
        if ($comparedWithPrevious -or [string]::IsNullOrWhiteSpace($previousIdentity.Package)) { continue }
        $comparedWithPrevious = $true
        if ($previousIdentity.Package -ne $newIdentity.Package) {
            Remove-Item -LiteralPath $whatsAppApk -Force -ErrorAction SilentlyContinue
            throw "The previous APK ($($previousApk.Name)) has package '$($previousIdentity.Package)' but this build has '$($newIdentity.Package)'. They would install as two different apps. If that earlier APK was itself a wrong build, delete it from the output folder and rebuild. APK removed."
        }
        if ($previousIdentity.Cert -and $newIdentity.Cert -and $previousIdentity.Cert -ne $newIdentity.Cert) {
            Remove-Item -LiteralPath $whatsAppApk -Force -ErrorAction SilentlyContinue
            throw "The previous APK ($($previousApk.Name)) is signed with a different certificate than this build, so Android will not update the installed app. Check $debugKeystore. If that earlier APK came from a different machine or key, delete it from the output folder to compare against a newer one. APK removed."
        }
    }
    Write-Host "Verified application identity matches '$ExpectedApplicationId' and the previous package's signing certificate." -ForegroundColor Green

        # Remove arm64-only APKs left by the previous split-build workflow.
    # This build now delivers one universal APK for mobile compatibility.
    Get-ChildItem -LiteralPath $OutDir -Filter "dugout-pulse-*-whatsapp-arm64.apk" -File -ErrorAction SilentlyContinue |
        Remove-Item -Force

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
