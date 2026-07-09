# Deploying Weblua on Coolify

Weblua is a static, client-side single-page app (Vite + React). Everything runs in the
browser — there is no Node server to keep alive in production, so Coolify only needs to
build the app and serve the resulting `dist/` folder as static files.

The one exception is the **optional Cloudflare Worker** for short links
(`cloudflare/worker.ts`, KV-backed `/api/snippets/*`). That's Cloudflare-specific (KV
storage) and is not part of this guide — see [Short links caveat](#short-links-caveat)
below for what that means for your deployment.

## Prerequisites

- A running Coolify instance (v4) with a server/resource pool attached.
- This repo pushed to a Git provider Coolify can reach (GitHub is simplest — connect it
  via a Coolify **GitHub App** source for private repos, or use the plain Git URL if the
  repo is public).
- Node 20+ compatibility — the project uses TypeScript 7 and Vite 8, so pin a modern Node
  version explicitly (see step 4).

## 1. Create a new resource

In your Coolify project/environment:

1. **+ New Resource → Application**.
2. Choose your source: **Public Repository** (paste the GitHub URL) or select your
   connected **GitHub App** and pick `PytechNo/Weblua`.
3. Branch: `main`.

## 2. Pick a build pack

Coolify auto-detects a build pack; you want one of these two. **Static** is the
simpler/recommended choice for this repo.

### Option A — Static build pack (recommended)

Coolify builds the app in a throwaway container, then serves the output directory with
an internal nginx image. No Dockerfile needed.

| Setting | Value |
|---|---|
| Build Pack | `Static` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Publish Directory | `dist` |

`npm run build` runs `tsc -b && tsc -p tsconfig.worker.json && vite build` — it
type-checks the app **and** the Cloudflare Worker types before building. That's fine;
type-checking the worker doesn't require deploying it.

### Option B — Dockerfile build pack (more control)

Use this if you want to pin the nginx config yourself (e.g. custom caching headers for
the wasm/worker bundles). Add a `Dockerfile` to the repo root:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

Then in Coolify: Build Pack → `Dockerfile`, and leave the rest as defaults. Coolify will
build and run this image directly.

> No SPA-fallback rewrite (`try_files ... /index.html`) is required — Weblua doesn't use
> path-based client routing (React Router etc.), only URL-hash sharing, so nginx's
> default static handling is enough.

## 3. Environment variables (build-time!)

Vite inlines `VITE_*` variables **at build time**, not runtime. In Coolify, add these
under the application's **Environment Variables**, and make sure they're marked
available during the build step (Coolify does this automatically for the Static/Dockerfile
build packs since the build runs inside the same env context):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_PLAUSIBLE_DOMAIN` | optional | Enables Plausible analytics, e.g. `weblua.com` |
| `VITE_SENTRY_DSN` | optional | Enables Sentry error reporting |

Leave both unset if you don't want analytics/error reporting — the app runs fine without
them (see [.env.example](../.env.example)).

If you change either value later, you must **redeploy** (trigger a rebuild), not just
restart — a runtime restart won't pick up new `VITE_*` values since they're already
baked into the built JS.

## 4. Pin the Node version

The project has no `engines` field, so Coolify will use its default Nixpacks/Docker Node
image. To avoid surprises with TypeScript 7 / Vite 8:

- **Static/Nixpacks build pack**: set a Coolify build-time environment variable
  `NIXPACKS_NODE_VERSION=20` (or 22).
- **Dockerfile build pack**: already pinned via `FROM node:20-slim` in the sample above.

## 5. Networking, port, and domain

- Static/Dockerfile-with-nginx serves on port `80` internally — Coolify's proxy handles
  this automatically; you don't need to expose a custom port.
- Add your domain under the application's **Domains** tab (e.g. `weblua.yourdomain.com`).
  Coolify provisions/renews a Let's Encrypt cert automatically once DNS points at your
  server.

## 6. Deploy

Click **Deploy**. Watch the build logs — you should see:

```
> tsc -b && tsc -p tsconfig.worker.json && vite build
...
vite v8.x building for production...
✓ built in ...
```

Once it's live, open the domain and confirm:

- The editor loads and Ctrl/Cmd-Enter runs a snippet (the Luau WASM worker initializes).
- No console errors about missing `VITE_SENTRY_DSN`/Plausible (these are optional and
  silently no-op if unset).

## 7. Auto-deploy on push (optional)

In the application's **Webhooks/General** settings, enable the GitHub deploy webhook (or
poll-based auto-deploy if you're not using the GitHub App integration) so pushes to
`main` trigger a rebuild automatically.

## Short links caveat

The `/p/:id` short-link feature (`cloudflare/worker.ts` + KV namespace, wired up via
`wrangler.toml`) is Cloudflare Workers + KV specific. Coolify has no equivalent to
Cloudflare KV, so:

- **Fragment-based sharing still works** with no backend — that's the default sharing
  method and needs nothing from this guide.
- If you want `/p/:id` short links too, keep deploying `cloudflare/worker.ts` to
  Cloudflare separately (`npm run worker:deploy`) and point `/api/snippets/*` at it via
  DNS/CNAME or a reverse-proxy rule on your Coolify domain — or reimplement that endpoint
  against a database (e.g. Postgres/Redis via a Coolify-hosted service) if you'd rather
  drop the Cloudflare dependency entirely.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build fails on `tsc -b` | Node version too old — pin Node 20+, see step 4 |
| Build succeeds, blank page | Check browser console for a wasm MIME-type/CORS error; ensure the static server (nginx) serves `.wasm` with `application/wasm` (default nginx does) |
| Analytics/Sentry not showing up | `VITE_*` vars must be set **before** the build that's currently deployed — redeploy after adding them |
| `/p/:id` links 404 | Expected — see [Short links caveat](#short-links-caveat) |
