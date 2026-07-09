# Weblua

Weblua is a client-side Lua playground for Lua 5.4 and Luau. It runs snippets in a Web Worker, captures output, supports URL-fragment sharing, and includes a Cloudflare Worker scaffold for short links.

## Run Locally

```sh
npm install
npm run dev
```

Open the local Vite URL and press Ctrl/Cmd-Enter to run the current snippet.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` type-checks the app and Cloudflare Worker, then builds the frontend.
- `npm run test` runs utility tests.
- `npm run worker:dev` starts the short-link Worker once KV IDs are configured.
- `npm run worker:deploy` deploys the short-link Worker.

## Short Links

Fragment links work without a backend. For `/p/:id` short links, create a Cloudflare KV namespace, replace the placeholder IDs in `wrangler.toml`, deploy the Worker, and route `/api/snippets/*` to it. The frontend POSTs snippets to `/api/snippets` and reads `/api/snippets/:id`.

## Production Hooks

Optional launch hooks are environment driven:

```sh
VITE_PLAUSIBLE_DOMAIN=weblua.com
VITE_SENTRY_DSN=https://example@sentry.io/project
```
