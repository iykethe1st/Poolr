$content = Get-Content github-issues.json -Raw
$content = $content -replace 'M0 â€" Foundation', 'M0 - Foundation'
$content = $content -replace 'M1 â€" Auth & Users', 'M1 - Auth & Users'
$content = $content -replace 'M2 â€" Groups & Cycles', 'M2 - Groups & Cycles'
$content = $content -replace 'M3 â€" Wallet & Dashboard', 'M3 - Wallet & Dashboard'
Set-Content github-issues.json $content