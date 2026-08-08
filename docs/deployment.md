# Deployment Guide

This document covers local development, recommended production deployment, environment variables, and the security/observability/CI practices recommended before this project handles real traffic.

> **Status check**: at the time of writing, this repository has **no** Dockerfile, CI workflow, or `render.yaml` — only `client/vercel.json` (a single-page-app rewrite rule). Everything below marked "recommended" is guidance for production-readiness, not a description of infrastructure that already exists.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
  - [Frontend on Vercel](#frontend-on-vercel)
  - [Backend on Render](#backend-on-render)
- [Environment Variables](#environment-variables)
  - [OpenAI Key](#openai-key)
  - [Auth0](#auth0)
  - [MongoDB](#mongodb)
- [Security](#security)
- [Rate Limiting](#rate-limiting)
- [Caching](#caching)
- [Monitoring](#monitoring)
- [Logging](#logging)
- [CI/CD Recommendations](#cicd-recommendations)

---

## Development Setup

```bash
git clone <repository-url>
cd homyz-main

# Backend
cd server
npm install
npx prisma generate
npm run start          # nodemon index.js → http://localhost:8000

# Frontend (separate terminal)
cd ../client
npm install
npm run dev             # vite → http://localhost:5173 (or next free port)
```

Requirements before either server will function correctly:

- `server/.env` populated with `DATABASE_URL` (MongoDB) and `OPENAI_API_KEY` (see [Environment Variables](#environment-variables)).
- An Auth0 SPA application configured to allow `http://localhost:5173` (or whichever port Vite lands on) as a callback/logout/web-origin URL.

The frontend currently talks to a **hardcoded** `http://localhost:8000/api` base URL (`client/src/utils/api.js`) and hardcoded Auth0 `domain`/`clientId`/`audience` (`client/src/main.jsx`). This is fine for local development but must be addressed before deploying to any other environment — see the note in [Environment Variables](#environment-variables) below.

## Production Deployment

### Frontend on Vercel

`client/vercel.json` already provides the SPA rewrite Vercel needs (`/* → /`, so client-side routes don't 404 on refresh):

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```

**Recommended steps:**

1. Import the repository into Vercel, set the project root to `client/`.
2. Build command: `npm run build` (Vite outputs to `client/dist`).
3. **Before deploying**, replace the hardcoded values in `client/src/utils/api.js` and `client/src/main.jsx` with Vite environment variables (`import.meta.env.VITE_*`), e.g.:
   ```js
   // utils/api.js
   export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

   // main.jsx
   <Auth0Provider
     domain={import.meta.env.VITE_AUTH0_DOMAIN}
     clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
     authorizationParams={{ redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI }}
     audience={import.meta.env.VITE_AUTH0_AUDIENCE}
     scope="openid profile email"
   >
   ```
   Then set `VITE_API_BASE_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_REDIRECT_URI` as Vercel project environment variables (per-environment: Preview vs. Production).
4. Add the deployed URL to the Auth0 application's **Allowed Callback URLs**, **Allowed Logout URLs**, and **Allowed Web Origins**.

### Backend on Render

No `render.yaml` exists yet; a manual Web Service works fine for a single Node service:

1. Create a new **Web Service**, root directory `server/`.
2. Build command: `npm install && npx prisma generate`.
3. Start command: `node index.js` (use `node`, not `nodemon`, in production — `nodemon` is a dev-only file-watcher and has no benefit on a static deployed instance).
4. Set the environment variables listed below in Render's dashboard (never commit `.env`).
5. **Before deploying**, move the Auth0 `audience`/`issuerBaseURL` in `server/config/auth0Config.js` out of hardcoded literals and into `process.env` (mirroring how `DATABASE_URL`/`OPENAI_API_KEY` already work), so the same codebase can point at different Auth0 tenants per environment without a code change.
6. Update `client`'s `VITE_API_BASE_URL` (see above) to the Render service's public URL once assigned.

## Environment Variables

### Backend (`server/.env`)

| Variable | Required | Notes |
|---|---|---|
| `PORT` | No | Defaults to `3000` in code; local dev currently uses `8000`. |
| `DATABASE_URL` | **Yes** | MongoDB connection string, consumed by Prisma's `mongodb` datasource. |
| `OPENAI_API_KEY` | **Yes**, for AI features | Powers both AI Search (filter extraction) and the Recommendation Engine's optional explanation step. Read exclusively via `process.env` — never hardcoded anywhere in the codebase. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. Override to point at a different OpenAI model without a code change. |

### OpenAI Key

- Generate from the OpenAI dashboard, scoped to a project if your organization uses project-scoped keys.
- **Never commit it.** It is read only via `process.env.OPENAI_API_KEY` (`server/services/aiService.js`) — if unset, `/api/ai/search` fails closed with a clean `503`, it does not silently disable the AI feature and continue serving degraded responses.
- Rotate it if it is ever exposed (logs, error messages, client bundles). It is never sent to the frontend and never appears in any response body.

### Auth0

- **Domain**, **Client ID**, and **Audience** currently live as hardcoded literals in `client/src/main.jsx` and `server/config/auth0Config.js`. Move both to environment variables before deploying anywhere but localhost (see [Frontend on Vercel](#frontend-on-vercel) and [Backend on Render](#backend-on-render) above).
- The backend's `jwtCheck` middleware (`express-oauth2-jwt-bearer`) validates token signature (RS256), issuer, and audience on every protected route — see [docs/api.md](api.md) for exactly which routes require it.
- Add every deployed frontend origin (Vercel preview + production URLs) to the Auth0 application's Allowed Callback URLs / Logout URLs / Web Origins, or login will fail with a redirect mismatch error.

### MongoDB

- Any MongoDB-compatible connection string works with Prisma's `mongodb` connector (MongoDB Atlas is the simplest managed option).
- Run `npx prisma generate` after any `DATABASE_URL` or schema change so the Prisma Client matches the deployed schema.
- The Search Service uses `prisma.residency.aggregateRaw()` for `bedrooms`/`bathrooms` filtering (Prisma's `where` can't reach into the `facilities` JSON column on the mongodb connector — see [docs/architecture.md](architecture.md#search-architecture)). This requires a database user with permission to run aggregation pipelines, which standard Atlas connection strings already grant.
- **Add indexes** on `city` and `price` before real traffic — neither the `where`-based scalar filters nor the `aggregateRaw` `$match` currently have an index to use, so every search is presently a collection scan.

## Security

Current state and recommendations, honestly:

| Area | Current state | Recommendation |
|---|---|---|
| CORS | `cors()` with no origin restriction (`server/index.js`) | Restrict to the deployed frontend origin(s) via `cors({ origin: [...] })` before going to production. |
| `POST /api/user/allBookings` | Not protected by `jwtCheck` — trusts a client-supplied `email` | Add `jwtCheck` and derive the email from the verified token instead of the request body, matching the other user routes. |
| Global error handling | None — most errors fall through to Express's default handler, which is not guaranteed to be JSON or to hide stack traces | Add a single `app.use((err, req, res, next) => ...)` JSON error handler as part of any production hardening pass. |
| Secrets | `.env` is git-ignored; keys read only via `process.env` | Use your host's secret manager (Vercel/Render environment variables) rather than committing or logging `.env` contents. |
| Input validation | AI prompt length-capped (500 chars) and type-checked; numeric search params validated | Consider request-body validation (e.g. Zod) on the `create`/`bookVisit`/`toFav` routes too — `createUser`/`createResidency` currently pass request bodies through with minimal field allow-listing. |

## Rate Limiting

**Not currently implemented.** This matters most for `POST /api/ai/search`: unlike the plain-DB-read endpoints, every request costs real OpenAI usage, so an unauthenticated, unrate-limited AI endpoint is a real cost/abuse exposure once the app is reachable publicly.

Recommended: an IP- or session-based rate limiter (e.g. `express-rate-limit`) applied specifically to `/api/ai/*`, tuned to your expected legitimate usage pattern (a chat UI, not a bulk API) — a stricter limit here than on the plain search endpoints is appropriate given the cost asymmetry.

## Caching

**Not currently implemented.** Reasonable candidates once traffic grows:

- Cache `GET /api/residency/allresd` for a short TTL (seconds, not minutes — new listings should appear promptly) at the CDN/reverse-proxy layer, since it's public and identical for every caller.
- Cache repeated identical `/api/ai/search` prompts briefly — the filter-extraction and (especially) the explanation-generation steps add real latency and cost that a short-lived cache could avoid for popular/duplicate queries.
- Do **not** cache authenticated user-scoped responses (`allBookings`, `allFav`) without keying strictly by user.

## Monitoring

**Not currently implemented.** Recommended minimum for production:

- Uptime/health checks against a lightweight endpoint (add a `GET /health` that responds `200` without touching the database or OpenAI, so infra checks don't burn DB/LLM quota).
- Track OpenAI request latency and error rate separately from the rest of the API — the AI endpoint has a materially different failure mode profile (timeouts, rate limits) than the DB-only routes.
- Track the Recommendation Engine's explanation success/fallback ratio (how often `explainRecommendationReasons` returns `null` and the deterministic fallback sentence is used) as a proxy for OpenAI reliability, since that failure is currently silent by design.

## Logging

**Currently minimal** — a handful of `console.log`/`console.error` calls in the controllers, no structured logging, no request IDs.

Recommended before production:

- Structured (JSON) logging with a request ID threaded through: incoming prompt → extracted filters → search query → recommendation scores → response, so a single AI search can be traced end-to-end.
- Redact the raw user `prompt` from logs if it might contain personal information, or at minimum don't log it alongside the OpenAI API key/config.
- Log (not silently swallow) every time `explainRecommendationReasons` falls back to the deterministic sentence, with the underlying error — currently it's caught and returns `null` with no log line, which is fine for user-facing resilience but makes production debugging harder without a log added at that catch site.

## CI/CD Recommendations

No CI/CD currently exists. A minimal, high-value pipeline for this stack:

1. **On every PR**: `npm install` + `npx vite build` for `client/`, and `node --check` (or a real test suite, once one exists) for `server/` — this project's own build was used as the primary correctness gate throughout development and catches import/syntax errors cheaply.
2. **Environment-specific deploys**: Vercel already supports preview deployments per-PR for the frontend; pair with a Render preview environment (or a staging service) for the backend so PRs can be reviewed against a fully working stack, not just the frontend in isolation.
3. **Secrets**: inject `DATABASE_URL`/`OPENAI_API_KEY`/Auth0 values via the CI/host's secret store, never via repository files.
4. **Prisma migrations**: run `npx prisma generate` (and `npx prisma db push`/migrations, once formal migrations are introduced) as an explicit CI/deploy step rather than relying on it having been run locally.
5. **Post-deploy smoke test**: hit `GET /api/residency/allresd` and `POST /api/ai/search` with a trivial prompt after every deploy — the second one is the cheapest way to catch an `OPENAI_API_KEY` misconfiguration before a real user does.
