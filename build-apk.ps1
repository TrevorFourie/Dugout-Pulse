# Baseball Hub - Windows Local Android APK Build Script
# Usage:
#   .\build-apk.ps1
#   .\build-apk.ps1 -Release
#   .\build-apk.ps1 -Install

param (
    [switch]$Release,
    [switch]$Install
)

$ErrorActionPreference = "Stop"

# Ensure we operate in the script's root directory
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Baseball Hub - Local APK Build Script " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Environment Setup (JDK 17 & Android SDK)
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
            Write-Host "Auto-detected JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
            break
        }
    }
}

if (-not $env:ANDROID_HOME) {
    $defaultSdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $defaultSdk) {
        $env:ANDROID_HOME = $defaultSdk
        Write-Host "Auto-detected ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
    }
}

# 2. Check Node Dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "`nInstalling npm dependencies..." -ForegroundColor Yellow
    npm install
}

# 3. Build Web Assets
Write-Host "`n[1/4] Building lean web assets..." -ForegroundColor Cyan
npm run build

# 4. Check if Android Platform is added
if (-not (Test-Path "android")) {
    Write-Host "`nInitializing Capacitor Android platform..." -ForegroundColor Yellow
    npx cap add android
}

# 5. Sync Web Assets to Android Platform
Write-Host "`n[2/4] Syncing web assets to Android platform..." -ForegroundColor Cyan
npx cap sync android

# 6. Fix JDK 17 Compatibility across all Android Gradle files
Write-Host "`n[2.5/4] Applying Java 17 compatibility across all Gradle configs..." -ForegroundColor Cyan


# Recursively patch only actual files (ignoring directories like .gradle)
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
            $raw = $raw -replace "jvmTarget = ""21""", "jvmTarget = ""17"""
            $raw = $raw -replace "sourceCompatibility = 21", "sourceCompatibility = 17"
            $raw = $raw -replace "targetCompatibility = 21", "targetCompatibility = 17"
            
            if ($raw -ne $orig) {
                Write-Host "  Patched Java 17 target in: $($file.Name)" -ForegroundColor DarkGray
                Set-Content -Path $file.FullName -Value $raw -NoNewline
            }
        }
    } catch {
        # Continue if a file is locked or cannot be read
    }
}

# Also patch every Capacitor package/plugin in node_modules (core, filesystem, share, ...)
# Each one ships its own build.gradle that targets Java 21.
$capGradleFiles = @()
if (Test-Path "node_modules\@capacitor") {
    $capGradleFiles = Get-ChildItem -Path "node_modules\@capacitor" -Recurse -File -Include "build.gradle","build.gradle.kts" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\build\\" -and $_.FullName -notmatch "\\node_modules\\.*\\node_modules\\" }
}
foreach ($file in $capGradleFiles) {
    try {
        $raw = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($raw) {
            $orig = $raw
            $raw = $raw -replace "JavaVersion\.VERSION_21", "JavaVersion.VERSION_17"
            $raw = $raw -replace "JavaVersion\.VERSION_22", "JavaVersion.VERSION_17"
            $raw = $raw -replace "VERSION_21", "VERSION_17"
            $raw = $raw -replace "VERSION_22", "VERSION_17"
            $raw = $raw -replace "jvmToolchain\(2[12]\)", "jvmToolchain(17)"
            $raw = $raw -replace "jvmTarget = '2[12]'", "jvmTarget = '17'"
            $raw = $raw -replace "jvmTarget = ""2[12]""", "jvmTarget = ""17"""
            if ($raw -ne $orig) {
                Write-Host "  Patched Java 17 target in: $($file.FullName.Replace((Get-Location).Path + '\', ''))" -ForegroundColor DarkGray
                Set-Content -Path $file.FullName -Value $raw -NoNewline
            }
        }
    } catch {}
}

# Set gradle.properties with Java home and memory
$gradleProperties = "android\gradle.properties"
if (Test-Path $gradleProperties) {
    $props = Get-Content -Path $gradleProperties -Raw -ErrorAction SilentlyContinue
    if (-not ($props -match "org.gradle.java.home")) {
        $escapedJavaHome = $env:JAVA_HOME -replace "\\", "/"
        Add-Content -Path $gradleProperties -Value "`norg.gradle.java.home=$escapedJavaHome"
    }
}

# 6.5 Clear stale compressed-asset output. Each web build produces new hashed file names
# (index-XXXX.js); Gradle's compressDebugAssets can fail with "already contains entry ...
# cannot overwrite" when leftovers from a previous build are still in this folder.
foreach ($stale in @("android\app\build\intermediates\compressed_assets", "android\app\build\intermediates\merged_assets")) {
    if (Test-Path $stale) {
        Write-Host "Clearing stale build output: $stale" -ForegroundColor DarkGray
        Remove-Item -Path $stale -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 7. Build APK with Gradle Wrapper
Write-Host "`n[3/4] Compiling APK using Gradle..." -ForegroundColor Cyan
Push-Location android

try {
    if ($Release) {
        .\gradlew.bat assembleRelease
        $apkSource = "app\build\outputs\apk\release\app-release-unsigned.apk"
        if (-not (Test-Path $apkSource)) {
            $apkSource = "app\build\outputs\apk\release\app-release.apk"
        }
    } else {
        .\gradlew.bat assembleDebug
        $apkSource = "app\build\outputs\apk\debug\app-debug.apk"
    }
} finally {
    Pop-Location
}

# 8. Output and Copy Finished APK
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$outDir = "apk-output"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$buildType = if ($Release) { "release" } else { "debug" }
$outputApkName = "baseball-hub-$buildType-$timestamp.apk"
$destination = "$outDir\$outputApkName"

$fullSourcePath = "android\$apkSource"
if (Test-Path $fullSourcePath) {
    Copy-Item -Path $fullSourcePath -Destination $destination -Force
    $fileSize = (Get-Item $destination).Length / 1MB
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host " [4/4] BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "APK Location: $destination ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
    Write-Host "`nTransfer this APK to your Android device via Bluetooth, Google Drive, or USB." -ForegroundColor White
} else {
    Write-Host "`nCould not locate built APK at $fullSourcePath" -ForegroundColor Red
    exit 1
}

# Optional ADB install
if ($Install) {
    Write-Host "`nAttempting adb install over connected device..." -ForegroundColor Cyan
    adb install -r $destination
}

Write-Host "`nDone!" -ForegroundColor Cyan