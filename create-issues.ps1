$issues = Get-Content -Raw github-issues.json | ConvertFrom-Json

foreach ($issue in $issues) {
    $labels = $issue.labels -join ","
    Write-Host "Creating #$($issue.number): $($issue.title)"
    
    gh issue create `
        --title $issue.title `
        --body $issue.body `
        --milestone $issue.milestone `
        --label $labels

    Start-Sleep -Milliseconds 500
}