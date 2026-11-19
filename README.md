# Super Six — Angular Dashboard

Angular 20 port of the Super Six static dashboard ("100 Month – 1 Million Portfolio Challenge",
Sep 2026 – Dec 2034, target $1,000,000). Static snapshot data: Wednesday 18 Nov 2026 close,
Combined $141,612 (Tiger $127,933 · IBKR $13,678).

## Run

```bash
npm install
npm run build        # production build → dist/super-six-angular/browser/
npm start            # dev server at http://localhost:4200
```

## Live data (optional)

The app ships with the static snapshot embedded and works without any backend.
To load live data from the Google Sheet, deploy `docs/apps-script/Code.gs`
(see `docs/apps-script/README.md`) and set `APPS_SCRIPT_DATA_URL` in
`src/app/core/services/portfolio-data.service.ts` to the `/exec` URL.
Fetch on load, every 15 minutes, plus the manual refresh button; on any failure
it falls back to the static snapshot.

## Deploy to Cloudflare Pages (not done — needs Senthil's approval)

1. Push this folder to GitHub repo `mmsenthilkumar/super-six-dashboard` (branch `main`).
   The repo currently serves the static `index.html`; the Angular project replaces it,
   so keep a backup of the static file first.
2. Cloudflare Pages → project `super-six-dashboard` → Settings → Builds & deployments:
   Framework preset **Angular**, Build command `npm run build`,
   Build output directory `dist/super-six-angular/browser`, Root directory `/`
   (or the repo subfolder if the project lives in a subfolder).
3. Every push to `main` then rebuilds + redeploys automatically at
   https://super-six-dashboard.pages.dev/ (behind the existing Cloudflare Access login).

## Structure

See `src/app/` — `core/` (models + portfolio-data + ui-preferences services),
`shared/` (info-popover, stat-grid, equity-cash-split, ticker-filter-bar, format pipe),
`features/` (challenge-hero, broker-tabs, combined-overview, broker-section),
`styles/` (_tokens.scss, _mobile-cards.scss).
