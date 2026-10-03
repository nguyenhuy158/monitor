# Repository Guidelines

## Project Structure & Module Organization

Odoo Monitor watches Odoo `ir.cron` jobs and emails an alert when a cron is
late (`nextcall < now`). It is a single Cloudflare Worker: a Hono API plus a
cron trigger, serving a React + Vite + Tailwind CSS v4 dashboard as static
assets from `dist/`. Data lives in Cloudflare D1; auth is the shared huyab SSO
cookie (`huyab_sso`, JWT verified against `SSO_ISSUER`'s JWKS); alert email
goes through the `mailer` service binding.

Folder structure:

```text
client/src/                    # Frontend (Vite root is the repo root, see index.html)
  main.tsx                     #   Entry: ToastProvider + App
  App.tsx                      #   Dashboard, configs and Settings tabs (main UI logic)
  index.css                    #   Imports styles/tokens.css
  styles/tokens.css            #   Design tokens, copied verbatim from ui-kit
  ui/                          #   In-house UI kit (`@ui` alias), copied from ui-kit
server/src/                    # Backend (Cloudflare Worker entry, see wrangler.jsonc)
  index.ts                     #   Hono API (/api/*), SSO check, scheduled() cron check
  odoo.ts                      #   Odoo JSON-RPC (/jsonrpc) client for ir.cron
public/                        # Static files copied into dist/
schema.sql                     # D1 schema (monitor_configs)
index.html                     # HTML shell (loads client/src/main.tsx)
vite.config.ts                 # Vite config, aliases `@` and `@ui`, LightningCSS
wrangler.jsonc                 # Worker config: D1, MAILER service, cron, route
```

`README.old.md` describes an older `src/worker` + `src/web` layout and is kept
only for history.

## Build, Test, and Development Commands

- `pnpm install`: install project dependencies.
- `pnpm dev`: run the worker (API + assets + cron) with `wrangler dev`.
- `pnpm dev:client`: run only the Vite dev server for the frontend.
- `pnpm build`: create the Vite production build in `dist/`.
- `pnpm check`: TypeScript typecheck (`tsc --noEmit`).
- `pnpm lint`: run Biome lint + format checks (report only).
- `pnpm format`: apply Biome formatting.

There is no test suite yet.

Deploy: push to GitHub only. Cloudflare Git Integration builds and deploys
automatically. Do NOT run `wrangler deploy` (`pnpm deploy`) locally.

Use `pnpm` for all package commands.

## Coding Style & Naming Conventions

Use TypeScript and React 19. Use two-space indentation and follow the existing
quote style of the file you edit. React components use PascalCase names.
Import UI components from the `@ui` alias and compose class names with `cn`.
Keep `client/src/ui/` and `client/src/styles/tokens.css` in sync with the
`ui-kit` repo instead of forking them; style with token utilities
(`bg-surface`, `text-fg-muted`, `border-border`, ...) rather than raw colors.
Dark mode is the `.dark` class on `<html>`. Avoid magic strings and numbers;
extract them into named constants.

UI conventions:

- Mobile-first, tuned for iPhone/Android; prefer Lucide icons over text on
  mobile.
- Dashboard data auto-reloads every 30s.
- Cron job list supports sorting and pagination (5 per page).
- Delayed crons show relative delay text (`trễ 5m`, `trễ 2h`).
- Alert delay threshold is per-user in the Settings tab (default 30 minutes).
- Pick the Odoo instance with the searchable `Combobox`.
- Use skeleton screens and empty states while loading.
- CSS is minified with LightningCSS (configured in `vite.config.ts`).

## Testing Guidelines

No automated tests exist yet. Verify changes with `pnpm check` and
`pnpm build`, and exercise the UI via `pnpm dev`. If tests are added, use
Vitest with test files colocated beside the module.

## Commit & Pull Request Guidelines

Use concise Conventional Commits, for example `feat: add cron delay filter` or
`fix: guard missing user in settings tab`. Pull requests should include a short
summary, check/build results, and screenshots for visible UI changes.

## Agent-Specific Instructions

Keep responses short and focused. If a requirement is unclear, ask before making
assumptions.
Design UI/UX to fit inside a single viewport by default. Avoid page-level
scrolling; use compact layouts, tabs, panes, or contained internal lists when
content can overflow.
