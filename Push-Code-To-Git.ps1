# push-app.ps1 - All-in-one Git Push Script

Param(
    [string]$CommitMessage = "Update repository files"
)

Clear-Host
Set-Location $PSScriptRoot

Write-Host "=== Git Status Check ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Staging Changes ===" -ForegroundColor Cyan
git add .

Write-Host "`n=== Committing Changes ===" -ForegroundColor Cyan
git commit -m "$CommitMessage"

Write-Host "`n=== Pushing to Remote Repository ===" -ForegroundColor Cyan
git push

Write-Host "`n=== Process Complete ===" -ForegroundColor Green