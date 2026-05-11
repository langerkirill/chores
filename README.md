# Rekindle Home Chores

A tiny shared chore calendar for Asuka and Kirill.

The frontend is static and lives in `docs/` so it can be deployed by GitHub Pages. Shared persistence uses a Cloudflare Worker with D1, Cloudflare's serverless SQLite-backed database. No GitHub tokens are needed in the browser.

## Local Development

```bash
npm install
npm run check
npm run serve
```

Open `http://127.0.0.1:4173`.

Without a Worker URL, the app stores entries in browser `localStorage`. Add the Worker URL in the settings dialog for shared persistence.

## Deploy The Database API

1. Install dependencies:

```bash
npm install
```

2. Log in to Cloudflare:

```bash
npx wrangler login
```

3. Create the D1 database:

```bash
npm run d1:create
```

4. Copy the returned `database_id` into `wrangler.toml`.

5. Apply the migration:

```bash
npm run d1:migrate
```

6. Deploy the Worker:

```bash
npm run worker:deploy
```

7. Copy the deployed Worker URL into `docs/config.js`:

```js
window.CHORE_API_URL = "https://chores-api.your-subdomain.workers.dev";
```

8. Commit and push that config change so GitHub Pages uses the shared API.

## GitHub Pages

The repo includes `.github/workflows/pages.yml`, which publishes the `docs/` folder through GitHub Pages on every push to `main`.

For private repos, GitHub Pages availability depends on the GitHub plan. If GitHub rejects Pages setup for a private personal repo, either make the repo public or host the static `docs/` folder on Cloudflare Pages.
