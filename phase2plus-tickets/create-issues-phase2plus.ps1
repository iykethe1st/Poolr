# Poolr - Phase 2 to Phase 5 GitHub Issues Import Script
# Run this from your Poolr repo root folder
# Requires: gh CLI authenticated, milestones created first


# Step 1: Create milestones (run these first)
gh api repos/iykethe1st/Poolr/milestones -f title="M4 - Private Beta"
gh api repos/iykethe1st/Poolr/milestones -f title="M5 - Compliance"
gh api repos/iykethe1st/Poolr/milestones -f title="M6 - Public Launch"
gh api repos/iykethe1st/Poolr/milestones -f title="M7 - Growth"

# Step 2: Create labels
gh label create admin --force
gh label create backend --force
gh label create beta --force
gh label create chore --force
gh label create compliance --force
gh label create devops --force
gh label create frontend --force
gh label create growth --force
gh label create launch --force
gh label create mobile --force
gh label create payments --force
gh label create wallet --force
gh label create web --force

# Step 3: Create issues
Write-Host "Creating #27: Beta: Set up staging environment on Railway and Vercel"
gh issue create --title "Beta: Set up staging environment on Railway and Vercel" --body-file "bodies/ticket-27-body.txt" --milestone "M4 - Private Beta" --label "chore,devops,beta"
Start-Sleep -Milliseconds 500

Write-Host "Creating #28: Beta: Recruit and onboard private beta testers"
gh issue create --title "Beta: Recruit and onboard private beta testers" --body-file "bodies/ticket-28-body.txt" --milestone "M4 - Private Beta" --label "beta,growth"
Start-Sleep -Milliseconds 500

Write-Host "Creating #29: Beta: End-to-end payment flow testing with real Paystack transactions"
gh issue create --title "Beta: End-to-end payment flow testing with real Paystack transactions" --body-file "bodies/ticket-29-body.txt" --milestone "M4 - Private Beta" --label "beta,payments"
Start-Sleep -Milliseconds 500

Write-Host "Creating #30: Beta: Bug triage, fixes, and regression testing"
gh issue create --title "Beta: Bug triage, fixes, and regression testing" --body-file "bodies/ticket-30-body.txt" --milestone "M4 - Private Beta" --label "beta,chore"
Start-Sleep -Milliseconds 500

Write-Host "Creating #31: Beta: Performance and load baseline testing"
gh issue create --title "Beta: Performance and load baseline testing" --body-file "bodies/ticket-31-body.txt" --milestone "M4 - Private Beta" --label "beta,chore,devops"
Start-Sleep -Milliseconds 500

Write-Host "Creating #32: Compliance: Engage a Nigerian fintech lawyer for regulatory review"
gh issue create --title "Compliance: Engage a Nigerian fintech lawyer for regulatory review" --body-file "bodies/ticket-32-body.txt" --milestone "M5 - Compliance" --label "compliance,chore"
Start-Sleep -Milliseconds 500

Write-Host "Creating #33: Compliance: Register with Nigeria Data Protection Commission (NDPC)"
gh issue create --title "Compliance: Register with Nigeria Data Protection Commission (NDPC)" --body-file "bodies/ticket-33-body.txt" --milestone "M5 - Compliance" --label "compliance,chore"
Start-Sleep -Milliseconds 500

Write-Host "Creating #34: Compliance: Draft and publish Terms of Service and Privacy Policy"
gh issue create --title "Compliance: Draft and publish Terms of Service and Privacy Policy" --body-file "bodies/ticket-34-body.txt" --milestone "M5 - Compliance" --label "compliance,chore"
Start-Sleep -Milliseconds 500

Write-Host "Creating #35: Compliance: Security audit and penetration testing"
gh issue create --title "Compliance: Security audit and penetration testing" --body-file "bodies/ticket-35-body.txt" --milestone "M5 - Compliance" --label "compliance,chore,devops"
Start-Sleep -Milliseconds 500

Write-Host "Creating #36: Launch: Build Poolr landing page"
gh issue create --title "Launch: Build Poolr landing page" --body-file "bodies/ticket-36-body.txt" --milestone "M6 - Public Launch" --label "frontend,web,launch"
Start-Sleep -Milliseconds 500

Write-Host "Creating #37: Launch: iOS App Store submission"
gh issue create --title "Launch: iOS App Store submission" --body-file "bodies/ticket-37-body.txt" --milestone "M6 - Public Launch" --label "mobile,launch"
Start-Sleep -Milliseconds 500

Write-Host "Creating #38: Launch: Google Play Store submission"
gh issue create --title "Launch: Google Play Store submission" --body-file "bodies/ticket-38-body.txt" --milestone "M6 - Public Launch" --label "mobile,launch"
Start-Sleep -Milliseconds 500

Write-Host "Creating #39: Launch: Set up production infrastructure and monitoring"
gh issue create --title "Launch: Set up production infrastructure and monitoring" --body-file "bodies/ticket-39-body.txt" --milestone "M6 - Public Launch" --label "devops,launch"
Start-Sleep -Milliseconds 500

Write-Host "Creating #40: Launch: Waitlist email campaign and launch announcement"
gh issue create --title "Launch: Waitlist email campaign and launch announcement" --body-file "bodies/ticket-40-body.txt" --milestone "M6 - Public Launch" --label "launch,growth"
Start-Sleep -Milliseconds 500

Write-Host "Creating #41: Growth: Referral programme"
gh issue create --title "Growth: Referral programme" --body-file "bodies/ticket-41-body.txt" --milestone "M7 - Growth" --label "backend,frontend,growth"
Start-Sleep -Milliseconds 500

Write-Host "Creating #42: Growth: Wallet interest sharing (float revenue share)"
gh issue create --title "Growth: Wallet interest sharing (float revenue share)" --body-file "bodies/ticket-42-body.txt" --milestone "M7 - Growth" --label "backend,wallet,growth"
Start-Sleep -Milliseconds 500

Write-Host "Creating #43: Growth: Trust score system"
gh issue create --title "Growth: Trust score system" --body-file "bodies/ticket-43-body.txt" --milestone "M7 - Growth" --label "backend,growth"
Start-Sleep -Milliseconds 500

Write-Host "Creating #44: Growth: B2B cooperative and corporate group onboarding"
gh issue create --title "Growth: B2B cooperative and corporate group onboarding" --body-file "bodies/ticket-44-body.txt" --milestone "M7 - Growth" --label "growth,backend,admin"
Start-Sleep -Milliseconds 500

Write-Host "Creating #45: Growth: Diaspora acquisition campaign"
gh issue create --title "Growth: Diaspora acquisition campaign" --body-file "bodies/ticket-45-body.txt" --milestone "M7 - Growth" --label "growth,launch"
Start-Sleep -Milliseconds 500

Write-Host "Creating #46: Growth: In-app group chat"
gh issue create --title "Growth: In-app group chat" --body-file "bodies/ticket-46-body.txt" --milestone "M7 - Growth" --label "backend,frontend,growth"
Start-Sleep -Milliseconds 500
