# Poolr - Fee model update tickets (#54-#60)
# Run from your Poolr repo root folder
# Requires: gh CLI authenticated, milestones already created

# Create any missing labels
gh label create admin --force
gh label create backend --force
gh label create chore --force
gh label create compliance --force
gh label create frontend --force
gh label create groups --force
gh label create growth --force
gh label create mobile --force
gh label create payments --force
gh label create web --force

# Create issues
Write-Host "Creating #54: API: Fee service - flat contribution fee collection and reserve deposit"
gh issue create --title "API: Fee service - flat contribution fee collection and reserve deposit" --body-file "bodies/ticket-54-body.txt" --milestone "M2 - Groups & Cycles" --label "backend,payments"
Start-Sleep -Milliseconds 500

Write-Host "Creating #55: API: Platform reserve - updated to be funded by contribution fees (replaces payout-based funding)"
gh issue create --title "API: Platform reserve - updated to be funded by contribution fees (replaces payout-based funding)" --body-file "bodies/ticket-55-body.txt" --milestone "M2 - Groups & Cycles" --label "backend,payments"
Start-Sleep -Milliseconds 500

Write-Host "Creating #56: API: Update ticket #52 - refund formula removes processing fee deduction"
gh issue create --title "API: Update ticket #52 - refund formula removes processing fee deduction" --body-file "bodies/ticket-56-body.txt" --milestone "M2 - Groups & Cycles" --label "backend,payments,groups"
Start-Sleep -Milliseconds 500

Write-Host "Creating #57: API + Web + Mobile: Update contribution flow to display platform fee before payment confirmation"
gh issue create --title "API + Web + Mobile: Update contribution flow to display platform fee before payment confirmation" --body-file "bodies/ticket-57-body.txt" --milestone "M2 - Groups & Cycles" --label "backend,frontend,web,mobile,payments"
Start-Sleep -Milliseconds 500

Write-Host "Creating #58: Compliance: Update legal review scope - fee charged on contributions not payouts"
gh issue create --title "Compliance: Update legal review scope - fee charged on contributions not payouts" --body-file "bodies/ticket-58-body.txt" --milestone "M5 - Compliance" --label "compliance,chore"
Start-Sleep -Milliseconds 500

Write-Host "Creating #59: API: Update trust score Elite perk - zero contribution fees for one group per month"
gh issue create --title "API: Update trust score Elite perk - zero contribution fees for one group per month" --body-file "bodies/ticket-59-body.txt" --milestone "M7 - Growth" --label "backend,growth"
Start-Sleep -Milliseconds 500

Write-Host "Creating #60: API: Update B2B billing type enum from TRANSACTION_FEE to CONTRIBUTION_FEE"
gh issue create --title "API: Update B2B billing type enum from TRANSACTION_FEE to CONTRIBUTION_FEE" --body-file "bodies/ticket-60-body.txt" --milestone "M7 - Growth" --label "backend,growth,admin"
Start-Sleep -Milliseconds 500
