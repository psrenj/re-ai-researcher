# re-ai-researcher

Casino & Offer AI Researcher demo built as an AI-first research assistant (no traditional scraper stack in v1).

## Stack

- API: Bun + Hono (runs in Node for local dev)
- Web: Next.js App Router SSR + customized shadcn-style components
- DB: SQLite + Drizzle ORM
- AI provider: OpenAI Responses API with web research tools

## Features

- Ingests current offers from Xano baseline endpoint.
- Discovers licensed/operational casinos in `NJ`, `MI`, `PA`, `WV`.
- Researches casino-only promotional offers (excludes sportsbook offers).
- Compares current vs discovered offers and classifies: `better`, `same`, `unclear`.
- Displays alternative offers when confidence is low/unclear.
- SSR dashboard:
  - `/` latest runs + queue button
  - `/runs/[id]` report view
  - `/runs/[id]/state/[abbr]` state drill-down
  - Run report includes sticky, minimizable side menu with `Overview`, `Casinos`, `Offers by Casino`, and `Run Logs` sections
- Run model:
  - `POST /api/runs` (on-demand, supports `mode`)
  - `POST /api/internal/scheduled-run` (daily cron stub)
  - `GET /api/baseline/stats` (tracked casino breakdown from Xano baseline)
  - `GET /api/runs/:runId/llm-traces` (raw model call traces for debugging)
  - Optional prompt template integration via `OPENAI_PROMPT_ID_CASINO_DISCOVERY` and `OPENAI_PROMPT_ID_CASINO_OFFERS_DISCOVERY`

## Security

All `/api/*` routes require `x-api-key` except `/api/health`.

- Env variable: `API_KEY`
- Header: `x-api-key` (hardcoded)

## Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Start API and web app:

```bash
npm run dev
```

- API: `http://localhost:8787`
- Web: `http://localhost:3000`

## API Endpoints

### Health (public)

```bash
curl http://localhost:8787/api/health
```

### Queue run (protected)

```bash
curl -X POST http://localhost:8787/api/runs \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"mode":"full"}'
```

Run modes:
- `full` (default): casino discovery + offer discovery + comparison
- `discover_casinos`: only casino coverage/missing discovery
- `discover_offers`: only offer discovery/comparison for tracked casinos

```bash
curl -X POST http://localhost:8787/api/runs \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"mode":"discover_casinos"}'
```

```bash
curl -X POST http://localhost:8787/api/runs \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"mode":"discover_offers"}'
```

### Canary run (cheap validation)

```bash
curl -X POST http://localhost:8787/api/runs \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"mode":"discover_offers","states":["NJ"],"maxCasinos":1}'
```

`maxCasinos` overrides the per-run offer batch size so you can validate behavior on 1 target before scaling.

### Get run summary (protected)

```bash
curl http://localhost:8787/api/runs/<RUN_ID> \
  -H "x-api-key: $API_KEY"
```

### Get run report (protected)

```bash
curl http://localhost:8787/api/runs/<RUN_ID>/report \
  -H "x-api-key: $API_KEY"
```

### Get run logs (protected)

```bash
curl http://localhost:8787/api/runs/<RUN_ID>/logs \
  -H "x-api-key: $API_KEY"
```

### Get run LLM traces (protected)

```bash
curl "http://localhost:8787/api/runs/<RUN_ID>/llm-traces?status=parse_failed&limit=100" \
  -H "x-api-key: $API_KEY"
```

### Scheduled trigger (protected)

```bash
./scripts/trigger-daily-run.sh
```

### Baseline stats (protected)

```bash
curl http://localhost:8787/api/baseline/stats \
  -H "x-api-key: $API_KEY"
```

## Suggested Daily Cron

```bash
0 9 * * * cd /path/to/re-ai-researcher && API_KEY=... API_BASE_URL=http://localhost:8787 ./scripts/trigger-daily-run.sh
```

## Testing and Checks

```bash
npm run test
npm run typecheck
```

## OpenAI Billing

- Runtime research calls in this app use `OPENAI_API_KEY` and are billed via OpenAI API usage.
- `MAX_CASINOS_PER_RUN` is now used as batch size. Runs continue through all batches until all targets are processed.
- Keep run caps (`MAX_CASINOS_PER_RUN`, token and concurrency limits) tuned for budget control.
