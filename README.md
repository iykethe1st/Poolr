# Poolr
 
> Rotating savings circles, reimagined for the modern age.
 
Poolr is a cross-platform fintech app that digitises the traditional West African *Ajo* / *Esusu* savings system. Groups of trusted people pool fixed contributions on a regular schedule, and each member receives the full pot in turn — no banks, no interest, just community-powered savings.
 
---
 
## Table of contents
 
- [Overview](#overview)
- [Monorepo structure](#monorepo-structure)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the apps](#running-the-apps)
- [Database](#database)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
---
 
## Overview
 
### How Poolr works
 
1. An admin creates a savings group and sets the contribution amount, frequency, and member limit.
2. Members are invited and must complete KYC verification before joining.
3. The admin assigns a fixed payout rotation order.
4. Every cycle, all members contribute. The pooled amount is paid out to the next member in rotation via Paystack.
5. Missed contributions trigger automatic penalties. The cycle repeats until every member has received the pot.
### Core features (MVP)
 
- Group creation and admin management
- Member invitations with KYC gating (Smile ID — BVN + NIN)
- Fixed-rotation payout scheduling
- In-app wallet and contribution tracking
- Paystack payment integration (collections + disbursements)
- Automated reminders via push, email, and SMS
- Penalty engine for missed contributions
- Admin and collector dashboard
---
 
## Monorepo structure
 
```
poolr/
├── apps/
│   ├── web/                  # Next.js 14 web app (App Router)
│   ├── mobile/               # React Native + Expo mobile app
│   ├── api/                  # NestJS backend API
│   └── admin/                # Next.js admin/collector dashboard
├── packages/
│   ├── database/             # Prisma schema, migrations, client
│   ├── types/                # Shared TypeScript types and enums
│   ├── ui/                   # Shared React component library (web)
│   ├── config/               # Shared ESLint, TypeScript, Tailwind configs
│   └── utils/                # Shared utility functions
├── tooling/
│   ├── eslint/
│   └── typescript/
├── .env.example
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```
 
---
 
## Tech stack
 
| Layer | Technology |
|---|---|
| Web frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Mobile | React Native, Expo SDK |
| Backend | NestJS, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache / queues | Redis + BullMQ |
| Auth | JWT + refresh tokens, OTP via Termii |
| Payments | Paystack |
| KYC | Smile ID (BVN, NIN) |
| Push notifications | Firebase FCM |
| Email | Resend |
| File storage | AWS S3 |
| Monorepo tooling | Turborepo + pnpm workspaces |
| Hosting (API) | Railway |
| Hosting (web) | Vercel |
| CI/CD | GitHub Actions |
| Error monitoring | Sentry |
 
---
 
## Getting started
 
### Prerequisites
 
- Node.js >= 20
- pnpm >= 9
- Docker (for local PostgreSQL and Redis)
### Installation
 
```bash
git clone https://github.com/your-org/poolr.git
cd poolr
pnpm install
```
 
### Copy environment variables
 
```bash
cp .env.example .env
```
 
Fill in the required values — see [Environment variables](#environment-variables).
 
### Start infrastructure
 
```bash
docker compose up -d
```
 
This starts a local PostgreSQL instance on port `5432` and Redis on port `6379`.
 
---
 
## Environment variables
 
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWT access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing JWT refresh tokens |
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook HMAC secret |
| `SMILE_ID_API_KEY` | Smile ID API key for KYC |
| `SMILE_ID_PARTNER_ID` | Smile ID partner ID |
| `TERMII_API_KEY` | Termii API key for OTP SMS |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging server key |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 |
| `AWS_S3_BUCKET` | S3 bucket name for KYC document uploads |
| `SENTRY_DSN` | Sentry DSN for error tracking |
 
---
 
## Running the apps
 
```bash
# Run all apps in development
pnpm dev
 
# Run a specific app
pnpm --filter @poolr/api dev
pnpm --filter @poolr/web dev
pnpm --filter @poolr/mobile dev
```
 
---
 
## Database
 
```bash
# Run migrations
pnpm --filter @poolr/database db:migrate
 
# Seed development data
pnpm --filter @poolr/database db:seed
 
# Open Prisma Studio
pnpm --filter @poolr/database db:studio
```
 
---
 
## Testing
 
```bash
# Run all tests
pnpm test
 
# Run tests for a specific package
pnpm --filter @poolr/api test
 
# Run e2e tests
pnpm --filter @poolr/api test:e2e
```
 
---
 
## Contributing
 
1. Branch from `main` using the convention `feat/`, `fix/`, or `chore/` prefixes.
2. Open a pull request against `main` — all PRs require at least one review.
3. Ensure all tests pass and there are no TypeScript errors before requesting review.
4. Reference the relevant GitHub issue in your PR description.
---
 
## License
 
MIT © Poolr
