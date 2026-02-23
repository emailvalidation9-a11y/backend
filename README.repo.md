# Backend — Repo config (standalone repo)

When **backend** is its own Git repo (root = this folder), use these files.

## Repo config

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI: install on push/PR to `main` or `develop`. |
| `vercel.json` | Vercel Node serverless: runs `server.js` as the handler. |
| `render.yaml` | Render: Node web service; set env vars in dashboard. |

## Deploy options

### Vercel (serverless)

- Import repo, root = `.`
- Add env vars in project settings (e.g. `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `VALIDATION_ENGINE_URL`).
- Vercel runs `server.js` via `@vercel/node`.

### Render

- New Web Service → connect repo (root = this folder).
- Render can use `render.yaml` for defaults; set secrets in dashboard: `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `VALIDATION_ENGINE_URL`.

### Other (Railway, Fly.io, VM)

- Run `npm start` (port from `PORT` or 5000).
- Set all vars from `.env.example`.

## Health

- `GET /api/health` — status + MongoDB
- `GET /api/health/live` — liveness
- `GET /api/health/ready` — readiness (DB)
