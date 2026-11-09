# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

### Demo analytics collector

Whereabouts uses Replit-hosted Project Analytics, not a separately configured
Umami installation. Replit's publishing proxy injects the tracker into published
website HTML when analytics is enabled. The app only calls the injected
`window.umami.track` through its failure-safe helper; do not add a script,
website ID, analytics environment variables, or a second collector.

Source: https://docs.replit.com/features/publishing/project-analytics
("Replit adds the analytics tracker to your published app. You do not need to add
a tracking script, website ID, or analytics environment variable.")
The project-analytics skill documents the injected `window.umami.track` contract.
Analytics access was checked and returned `authorized` during instrumentation.
This establishes access, not that a published release has analytics enabled.

`demo_sample_open` counts direct sample-result opens; `demo_sample_run` counts
starts of the simulated flow, not live analyses or completions. Their only custom
property is the fixed sample `scenario_id`.

Development previews intentionally have no collector. Tests verify forwarding
to the injected interface and safe behavior when it is absent, throws, or rejects;
they do not prove delivery to a published report. After merging, a release with
Enable analytics turned on is required for collection. Nothing should be
published from a task fork solely to test analytics.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
