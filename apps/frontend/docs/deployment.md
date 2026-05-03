# Deployment Guide — AWS Amplify

This document covers how to deploy the Ignitic AI frontend to **AWS Amplify Hosting** with full SSR support.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [First-time Setup](#3-first-time-setup)
4. [Environment Variables](#4-environment-variables)
5. [Build Configuration](#5-build-configuration)
6. [Deployment](#6-deployment)
7. [Custom Domain](#7-custom-domain)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Overview

The frontend is deployed as a **standalone Next.js** application on AWS Amplify Hosting. Amplify handles:

- Automatic builds on Git push
- Serverless SSR execution (Lambda@Edge / CloudFront)
- HTTPS and CDN via CloudFront
- Environment variable injection at build time

### Output Mode

`next.config.ts` sets `output: "standalone"` which bundles only the files needed to run the server. The `amplify.yml` file instructs Amplify to deploy the `.next` directory.

---

## 2. Prerequisites

- An AWS account with Amplify permissions
- The repository connected to GitHub, GitLab, or Bitbucket
- Cloudinary account with cloud name, API key, and API secret
- A deployed instance of the Backend API accessible via HTTPS

---

## 3. First-time Setup

### 3.1 Connect Repository to Amplify

1. Sign in to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/).
2. Click **New App → Host web app**.
3. Select your Git provider (GitHub) and authorize access.
4. Choose the `frontend` repository and the branch to deploy (e.g., `main`).
5. Amplify will detect the `amplify.yml` file — confirm the build settings.

### 3.2 Configure Build Settings

Amplify will use the `amplify.yml` file at the repository root. No manual build configuration is required. Verify the detected settings match:

- **Root directory:** Leave empty (or `frontend` if inside a monorepo)
- **Build command:** `npm run build` (driven by `amplify.yml`)
- **Artifact base directory:** `.next`

---

## 4. Environment Variables

Set the following variables in **Amplify Console → App settings → Environment variables**:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Full HTTPS URL of the Backend API, no trailing slash. Example: `https://api.ignitic.ai` |
| `NEXTAUTH_SECRET` | ✅ | Generate with `openssl rand -base64 32`. Must be the same value across all deployments. |
| `NEXTAUTH_URL` | ✅ | The canonical public URL of this frontend. Example: `https://app.ignitic.ai` |
| `AUTH_TRUST_HOST` | ☑️ recommended | Set to `true` so NextAuth uses `x-forwarded-host` header. Required on Amplify when `NEXTAUTH_URL` may change. |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |

> **Important:** AWS Amplify does not automatically pass Console environment variables into the SSR Lambda runtime. The `amplify.yml` build script works around this by writing relevant variables into `.env.production` before `next build`:
>
> ```yaml
> - env | grep -e NEXTAUTH_SECRET -e AUTH_SECRET >> .env.production
> - env | grep -e NEXTAUTH_URL -e AUTH_TRUST_HOST >> .env.production || true
> - env | grep -e NEXT_PUBLIC_ >> .env.production || true
> ```
>
> This ensures Next.js inlines the values at build time and the Lambda can read them at runtime.

### Branch-specific Variables

For staging environments, use the **Branch-level environment variables** feature in Amplify to override `NEXT_PUBLIC_API_URL` and `NEXTAUTH_URL` per branch.

---

## 5. Build Configuration

The full build configuration is in [`amplify.yml`](../amplify.yml):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm install 20        # Pin to Node.js 20
        - nvm use 20
        - node -v
        - npm ci                # Clean install from lockfile
    build:
      commands:
        - touch .env.production
        # Write auth env vars into .env.production for SSR runtime access
        - env | grep -e NEXTAUTH_SECRET -e AUTH_SECRET >> .env.production
        - env | grep -e NEXTAUTH_URL -e AUTH_TRUST_HOST >> .env.production || true
        - env | grep -e NEXT_PUBLIC_ >> .env.production || true
        - npm run build
  artifacts:
    baseDirectory: .next       # Deploy the .next output directory
    files:
      - "**/*"
  cache:
    paths:
      - node_modules/**/*      # Cache node_modules between builds
      - .next/cache/**/*       # Cache Next.js build cache
```

### Build Time

A typical build takes 3–6 minutes. The `node_modules` and `.next/cache` caches significantly reduce subsequent build times.

---

## 6. Deployment

### Automatic Deployment

Every push to the connected branch automatically triggers a new build and deployment. No manual steps are required.

### Manual Deployment

To trigger a manual deployment:
1. Go to **Amplify Console → Your App → Hosting → Branch**.
2. Click **Redeploy this version** to redeploy the last successful build.
3. Click **Run build** to trigger a fresh build from the latest commit.

### Deployment Environments

| Branch | Environment | URL |
|---|---|---|
| `main` | Production | `https://app.ignitic.ai` |
| `staging` | Staging | `https://staging.app.ignitic.ai` |
| Feature branches | Preview | Auto-generated Amplify URL |

---

## 7. Custom Domain

1. Go to **Amplify Console → App settings → Domain management**.
2. Click **Add domain** and enter your domain (e.g., `ignitic.ai`).
3. Add subdomain mapping: `app` → `main` branch.
4. Update DNS records as instructed by Amplify (CNAME or ANAME records).
5. Amplify provisions and renews an SSL certificate via AWS Certificate Manager.

After the domain is active, update `NEXTAUTH_URL` to the custom domain URL.

---

## 8. Troubleshooting

### NextAuth Callback URL Mismatch

**Symptom:** Sign-in redirects to the wrong URL or fails with a callback error.

**Fix:**
1. Ensure `NEXTAUTH_URL` is set to the exact public URL (no trailing slash).
2. Alternatively, set `AUTH_TRUST_HOST=true` to let NextAuth derive the URL from request headers.

### Environment Variables Not Available at Runtime

**Symptom:** `NEXTAUTH_SECRET` is undefined in the SSR Lambda; sign-in fails.

**Fix:** Verify the `amplify.yml` build script is writing variables to `.env.production`. Check the build logs for the `env | grep` lines.

### Build Fails: Module Not Found

**Symptom:** `npm run build` fails with a module resolution error.

**Fix:** Ensure `npm ci` ran successfully. Check that all dependencies in `package.json` are compatible with Node.js 20.

### Large Bundle Size Warning

**Symptom:** Build warnings about large page bundles.

**Fix:** The `next.config.ts` enables `optimizePackageImports` for heavy libraries (`lucide-react`, `recharts`, `framer-motion`). Ensure tree-shaking is not blocked by wildcard imports.

### WebSocket Connection Refused

**Symptom:** Chat fails with a WebSocket connection error in production.

**Fix:** Confirm `NEXT_PUBLIC_API_URL` points to the production backend and the backend's WebSocket endpoint (`/api/v1/agents/ws`) is accessible over `wss://` from the Amplify domain.
