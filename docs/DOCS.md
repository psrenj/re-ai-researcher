# Casino & Offer AI Researcher

## 1. Overview

The demo solves a practical question:
- "Are baseline tracked casino offers still accurate, and where are we missing coverage?"

Target output:
- Missing casinos by state
- Offer comparisons (`better | same | unclear`)
- Evidence/citations and confidence
- Fast enough operation for iterative testing and demos

## 2. Architecture

### API: Hono + TypeScript + SQLite

Why this was chosen:
- Lightweight server footprint with clear route/middleware model
- Fast local iteration and simple deployment with Docker
- SQLite is enough for demo scale since this is not a high-traffic application, while still enabling durable run history, traces, and snapshots

Trade-off:
- SQLite is not ideal for high-concurrency distributed workers
- Acceptable for current demo scope and short iteration loop

### Web: Next.js App Router (SSR)

Why this was chosen:
- SSR lets the web server call protected API routes with `x-api-key`
- Good fit for report views and direct deep links (`/runs/[id]`, state pages)
- Fast to deliver a polished dashboard with server-rendered data

Trade-off:
- Build/runtime env separation requires careful handling in container deploys
- Resolved by server-side runtime env loading for API base URL and API key validation

### Shared Types Package

Why this was chosen:
- One type contract for API and web
- Reduced UI/API drift while iterating quickly
- Cleaner refactoring for verdict logic, traces, and report model changes

## 3. Research Pipeline Design

Stages:
1. Baseline ingestion from Xano endpoint, saved to database for persistence and fallback.
2. Casino discovery (state-level)
3. Offer discovery (casino-level)
4. Local comparison and verdicting
5. Persist report + logs + traces

Key design choices:
- AI-research-first
- OpenAI Responses API with web research tool
- Source citations captured and surfaced in reports
- Comparison logic remains deterministic in our code (not delegated to free-form model output)
- Explicit run modes:
  - `full`: baseline ingest + casino discovery + offer discovery + comparison
  - `discover_casinos`: discovery-only coverage/missing analysis
  - `discover_offers`: offer analysis for tracked casinos
- `MAX_CASINOS_PER_RUN` is batch-size semantics, not a hard stop; all targets are processed batch-by-batch
- Offer discovery emits per-batch stage events with processed/failed progress

## 4. Why OpenAI-Only in v1

Reasons:
- Faster integration under timebox
- One provider means lower complexity while stabilizing pipeline behavior
- Prompt-template support improves consistency and reduces parsing failures

Model iteration notes (encountered during implementation):
- First pass used `gpt-4` models. Quality was acceptable, but throughput/latency for repeated research runs was not ideal.
- Next pass used `gpt-5-nano`. It was faster, but accuracy dropped for extraction/comparison reliability.
- In tuning runs, `gpt-5-mini` produced a better speed/accuracy balance for web research in this demo context.
- Current request handling enforces `reasoning.effort=medium` as the quality/cost baseline.
- Model selection remains env-configurable (repository defaults are `gpt-4.1-mini` for discovery and `gpt-4.1` for extraction), so deployment can switch to `gpt-5-mini` when preferred.

Trade-off:
- Vendor concentration
- Addressed in roadmap with multi-provider adapter plan

## 5. Reliability and Control Mechanisms

### Structured Parsing and Fallbacks

Issues observed:
- Empty `output_text` even when tool calls were present
- Non-JSON or malformed JSON responses
- `max_output_tokens` truncation
- Prompt-template incompatibilities (for example, variable mismatch or unsupported parameter behavior)

Changes made:
- Schema-constrained parse path plus strict JSON retry path
- Continuation request when output is truncated or clarification text is returned
- Raw trace persistence for every request/parse path
- Prompt-template fallback path that disables failing template IDs and continues through the standard prompt path

### Run Continuity

Issues observed:
- Progress visibility was weak while runs were still executing
- Single-target failures could block confidence in run completeness

Changes made:
- Stage events and issues persisted
- Progress report persisted during run
- Partial failure tolerance (run can complete with issues)
- Per-target failures are logged as issues while remaining targets continue
- Running reports live-refresh in the UI until terminal status

### Security

Model:
- Protected API routes with shared `API_KEY`
- Header: `x-api-key`
- `/api/health` remains public

Trade-off:
- Security is limited to shared-secret API protection for server/API calls
- Dashboard can be accessed anonymously
- A short-term improvement can be basic auth on the client side
- This can be improved by implementing full user auth/RBAC

## 6. Performance Approach

Issues observed:
- Slow process for both casino and offer discovery when data set is large
- Before incremental persistence was added, all requests had to finish before full report population

Changes made:
- Casino discovery runs with bounded concurrency by state
- Offer discovery moved from sequential calls to bounded concurrency
- Batch processing to cover all targets without silent truncation
- Retry/backoff with jitter for transient failures
- Incremental report persistence during run (instead of waiting for full completion)
- Run page auto-refresh while status is `queued` or `running`
- Optimistic evaluation and persistence of results

Outcome:
- Faster end-to-end runtime and better operator feedback during long runs
- Large target sets are processed predictably in batches rather than silently truncated

Trade-off:
- Higher reasoning/verbosity improves quality but increases latency/cost
- Lower reasoning is faster but may reduce extraction quality

## 7. Important Fixes Implemented

Issues observed:
- Model responses sometimes drifted from required JSON format
- Casinos with no tracked offers could show `unclear` instead of `better`
- Long responses failed at `max_output_tokens`
- Baseline feed availability could be transient in production
- Prompt-template calls could fail due variable/parameter incompatibilities
- SSR web calls could fail from runtime API key/env resolution mismatch
- Node 24 container builds failed for native `better-sqlite3` dependency

Changes made:
- Added prompt templates and stricter structured parsing with fallback paths
- Updated verdict behavior so missing tracked offers default to `better` when discovered offers exist
- Added continuation requests for truncated outputs
- Added baseline fallback to latest persisted snapshot from DB
- Added template incompatibility handling (disable failing template ID, continue with standard prompt)
- Consolidated web runtime env/API key loading validation for server-side API calls
- Added required Docker build packages (`python3`, `make`, `g++`) for native module compilation

Outcome:
- Parsing reliability improved and malformed-response failures were reduced
- Comparison results align better with expected baseline-vs-discovered logic
- Long outputs recover instead of hard-failing target processing
- Baseline-dependent dashboard views remain available during transient feed issues
- Runs continue automatically even when prompt templates fail
- SSR pages can reliably call protected API routes in deployment
- API/web container builds complete consistently on Node 24 images

## 8. UI

- Actionable-first comparison view (`better`/`unclear`)
- Casino-level grouping for readability
- State filter and drilldowns for focused analysis
- Inline evidence links near findings
- Sidebar navigation aligned with current implementation:
  - Primary links: `Dashboard`, `Tracked Casinos`, `Latest Run Comparison`, `Recent Runs`
  - Run report views: `Overview`, `Casinos`, `Offers`, `Logs`

## 9. Known Limitations (Current)

- Single provider in production path
- No full user auth/RBAC (shared API key only)
- SQLite limits horizontal scale
- LLM output quality still prompt/model sensitive
- Research quality and latency depend on reasoning settings and source availability

## 10. Roadmap

- [ ] Add multi-provider selector (not limited to OpenAI)
- [ ] Add model selection controls
- [ ] Add pagination for long report surfaces
- [ ] Add configurable reasoning effort in run controls
- [ ] Expose speed/quality trade-off guidance in UI
- [ ] Add stronger guardrails for non-compliant model outputs
- [ ] Expand monitoring for token truncation/retry behavior
- [ ] Define storage migration thresholds and execution plan for SQLite to PostgreSQL transition

Storage roadmap (SQLite now, PostgreSQL when needed):
- SQLite remains the default for low-traffic workloads where runs are mostly scheduled/on-demand and accessed by a small group.
- SQLite has lower baseline cost because it primarily needs persistent disk, with no always-on database compute service.
- PostgreSQL adds higher baseline cost due to always-on RAM/vCPU plus storage, backups, and operational overhead.
- PostgreSQL migration makes sense once traffic/concurrency is high (for example, many simultaneous users, parallel workers, or stronger HA/scaling requirements).
