# Get-LatestFromGitHub.ps1
# Updates the local repository to match the latest "main" branch on GitHub.
# WARNING: Local changes and untracked files may be permanently deleted.
$ErrorActionPreference = 'Stop'

try {
    # Confirm the current directory is a Git repository
    git rev-parse --is-inside-work-tree | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "The current directory is not inside a Git repository."
    }

    # Explicitly target the main branch
    $TargetBranch = "main"
    $Upstream = "origin/main"

    Write-Host "`nTarget Local branch: $TargetBranch" -ForegroundColor Cyan
    Write-Host "Remote branch: $Upstream" -ForegroundColor Cyan

    # Fetch the latest changes from GitHub
    Write-Host "`nFetching latest changes from GitHub..." -ForegroundColor Cyan
    git fetch origin main
    if ($LASTEXITCODE -ne 0) {
        throw "Git fetch failed. Check your connection and GitHub authentication."
    }

    # Checkout the local main branch if not already on it
    $CurrentBranch = git branch --show-current
    if ($CurrentBranch -ne $TargetBranch) {
        Write-Host "`nSwitching to branch '$TargetBranch'..." -ForegroundColor Yellow
        git checkout $TargetBranch
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to switch to branch '$TargetBranch'."
        }
    }

    # Force the local branch to match its remote tracking branch
    Write-Host "`nResetting local branch to GitHub ($Upstream)..." -ForegroundColor Yellow
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
