# push-app.ps1 - All-in-one Git Push Script
Param(
    [string]$CommitMessage = "Update repository files"
)

Clear-Host
Set-Location $PSScriptRoot

# Ensure we are working on the main branch
$TargetBranch = "main"
$CurrentBranch = git branch --show-current

if ($CurrentBranch -ne $TargetBranch) {
    Write-Host "Switching from '$CurrentBranch' to '$TargetBranch'..." -ForegroundColor Yellow
    git checkout $TargetBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Could not switch to $TargetBranch branch. Aborting." -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== Git Status Check ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Staging Changes ===" -ForegroundColor Cyan
git add .

Write-Host "`n=== Committing Changes ===" -ForegroundColor Cyan
# Only commit if there are actually staged changes to prevent script errors
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "$CommitMessage"
} else {
    Write-Host "No changes to commit." -ForegroundColor Yellow
}

Write-Host "`n=== Pushing to Remote Repository (main) ===" -ForegroundColor Cyan
git push origin main

Write-Host "`n=== Process Complete ===" -ForegroundColor Green
