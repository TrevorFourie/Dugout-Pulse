# Get-LatestFromGitHub.ps1
# Updates the local repository to match the latest version on GitHub.
# WARNING: Local changes and untracked files may be permanently deleted.

$ErrorActionPreference = 'Stop'

try {
    # Confirm the current directory is a Git repository
    git rev-parse --is-inside-work-tree | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "The current directory is not inside a Git repository."
    }

    # Identify the current branch and its upstream
    $Branch = git branch --show-current

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($Branch)) {
        throw "Could not determine the current branch."
    }

    $Upstream = git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>$null

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($Upstream)) {
        throw "No upstream branch is configured for '$Branch'."
    }

    Write-Host "`nLocal branch:  $Branch" -ForegroundColor Cyan
    Write-Host "Remote branch: $Upstream" -ForegroundColor Cyan

    # Fetch the latest changes from GitHub
    Write-Host "`nFetching latest changes from GitHub..." -ForegroundColor Cyan
    git fetch

    if ($LASTEXITCODE -ne 0) {
        throw "Git fetch failed. Check your connection and GitHub authentication."
    }

    # Force the local branch to match its remote tracking branch
    Write-Host "`nResetting local branch to GitHub..." -ForegroundColor Yellow
    git reset --hard $Upstream

    if ($LASTEXITCODE -ne 0) {
        throw "Git reset failed."
    }

    # Remove untracked files and directories
    Write-Host "`nRemoving untracked files..." -ForegroundColor Yellow
    git clean -fd

    if ($LASTEXITCODE -ne 0) {
        throw "Git clean failed."
    }

    Write-Host "`nSuccessfully updated to the latest GitHub version!" -ForegroundColor Green
    git status --short --branch
}
catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}