# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Delivery (CI/CD) pipeline for the Ignitic AI frontend.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pipeline Architecture](#2-pipeline-architecture)
3. [AWS Amplify Automatic Deployments](#3-aws-amplify-automatic-deployments)
4. [Branch Strategy](#4-branch-strategy)
5. [Build Pipeline Steps](#5-build-pipeline-steps)
6. [Environment-specific Deployments](#6-environment-specific-deployments)
7. [Rollback](#7-rollback)
8. [Adding GitHub Actions (Optional)](#8-adding-github-actions-optional)

---

## 1. Overview

The CI/CD pipeline is built on **AWS Amplify Hosting's native Git-based deployment** model. Every push to a tracked branch automatically triggers a build and deployment. There is no separate CI server required for deployments.

```
Developer Push
     │
     ▼
GitHub Repository
     │
     ▼
AWS Amplify (webhook trigger)
     │
     ├─► preBuild  (nvm install, npm ci)
     ├─► build     (env injection, next build)
     └─► deploy    (.next artifacts → CloudFront)
          │
          ▼
     Production / Preview URL
```

---

## 2. Pipeline Architecture

| Stage | Tool | Trigger |
|---|---|---|
| Source control | GitHub | Manual push / PR merge |
| Build & deploy | AWS Amplify Hosting | Git push webhook |
| Preview deployments | Amplify Preview | Pull request creation |
| CDN & SSR | AWS CloudFront + Lambda@Edge | Automatic |
| SSL / TLS | AWS Certificate Manager | Automatic |

---

## 3. AWS Amplify Automatic Deployments

### How It Works

1. A developer pushes a commit to a connected branch (e.g., `main`).
2. GitHub sends a webhook to AWS Amplify.
3. Amplify checks out the code and runs the build pipeline defined in `amplify.yml`.
4. On success, the new build is atomically deployed to CloudFront.
5. The previous deployment is retained for rollback.

### Build Status

Build status is visible in:
- **AWS Amplify Console** → App → Hosting → Branch builds
- **GitHub** via the Amplify GitHub App (shows pass/fail on commits and PRs)

---

## 4. Branch Strategy

| Branch | Purpose | Amplify Environment |
|---|---|---|
| `main` | Production-ready code | Production |
| `staging` | Pre-production testing | Staging |
| `feature/*` / `fix/*` | In-progress work | Pull Request Preview |

### Pull Request Previews

Amplify can be configured to automatically create a **preview URL** for every open pull request. This allows reviewers to interact with a live build of the changes before merging.

To enable:
1. Go to **Amplify Console → App settings → Previews**.
2. Enable **Pull request previews** for the connected repository.
3. Each PR gets a unique URL (e.g., `https://pr-42.d123456.amplifyapp.com`).

---

## 5. Build Pipeline Steps

Defined in `amplify.yml`:

### preBuild

```yaml
preBuild:
  commands:
    - nvm install 20     # Install Node.js 20 (pinned version)
    - nvm use 20
    - node -v            # Verify version for build logs
    - npm ci             # Reproducible install from package-lock.json
```

**Purpose:** Ensure a clean, reproducible dependency install with the correct Node.js version.

### build

```yaml
build:
  commands:
    - touch .env.production
    - env | grep -e NEXTAUTH_SECRET -e AUTH_SECRET >> .env.production
    - env | grep -e NEXTAUTH_URL -e AUTH_TRUST_HOST >> .env.production || true
    - env | grep -e NEXT_PUBLIC_ >> .env.production || true
    - npm run build
```

**Purpose:**
1. Write sensitive environment variables to `.env.production` so Next.js can inline them at build time and the SSR Lambda can read them at runtime.
2. Run `next build` to produce the standalone output.

### artifacts

```yaml
artifacts:
  baseDirectory: .next
  files:
    - "**/*"
```

**Purpose:** Tell Amplify to deploy the entire `.next` directory (standalone server bundle + static assets).

### cache

```yaml
cache:
  paths:
    - node_modules/**/*
    - .next/cache/**/*
```

**Purpose:** Cache `node_modules` and Next.js incremental build cache between builds to reduce build time from ~5 min to ~2 min.

---

## 6. Environment-specific Deployments

### Production (`main` branch)

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.ignitic.ai` |
| `NEXTAUTH_URL` | `https://app.ignitic.ai` |
| `AUTH_TRUST_HOST` | `true` |

### Staging (`staging` branch)

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://staging-api.ignitic.ai` |
| `NEXTAUTH_URL` | `https://staging.app.ignitic.ai` |
| `AUTH_TRUST_HOST` | `true` |

Branch-level environment variables can be set per-branch in **Amplify Console → App settings → Environment variables → Branch-level overrides**.

---

## 7. Rollback

### Instant Rollback via Amplify Console

1. Go to **Amplify Console → App → Hosting → Branch**.
2. Click on the build history.
3. Select a previous successful build.
4. Click **Redeploy this version**.

Rollback takes approximately 1–2 minutes (no new build required — Amplify redeploys the previous artifact).

### Git-based Rollback

```bash
# Revert the offending commit and push to trigger a new clean build
git revert <commit-sha>
git push origin main
```

---

## 8. Adding GitHub Actions (Optional)

While Amplify handles deployment, you can add **GitHub Actions** for code quality checks on pull requests (lint, type-check, tests) before code is merged.

### Example: Lint and Type Check Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main]

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: TypeScript type check
        run: npx tsc --noEmit
```

This workflow runs on every PR and push, giving developers early feedback before Amplify kicks off the full build and deployment.

### Integration with Amplify

GitHub Actions and Amplify work independently:
- GitHub Actions runs linting/tests and reports on the PR.
- Amplify triggers a build and reports deployment status on the PR.
- PRs should require both checks to pass before merging.
