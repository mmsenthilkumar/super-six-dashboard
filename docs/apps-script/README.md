# Apps Script — Super Six live data endpoint

This folder holds the Google Apps Script that serves the Angular dashboard's
holdings JSON straight from the Google Sheet. **Do not deploy it from here —
Senthil deploys it himself in the sheet.**

## Deploy (in the sheet)

1. Open the sheet **"Senthil - Individual Shares"**.
2. **Extensions → Apps Script**.
3. Delete the default `Code.gs` content and paste in `Code.gs` from this folder.
4. **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (the Angular app fetches it from the browser with no sign-in;
     anyone with the URL can fetch the holdings JSON — same exposure as the current public dashboard).
5. Click **Deploy** and copy the web-app URL — it ends in `/exec`.

## Wire it into the Angular app

In `src/app/core/services/portfolio-data.service.ts`, set:

```ts
export const APPS_SCRIPT_DATA_URL = 'https://script.google.com/macros/s/<deployment-id>/exec';
```

That is the **only** config value to fill in. Then rebuild and redeploy the Angular app.

## Behaviour

- The app fetches on load, then every **15 minutes**, plus the manual refresh button.
- If no URL is configured, or the fetch fails, the app falls back to the embedded
  static snapshot (Wednesday 18 Nov 2026 close, Combined $141,612) — it keeps working.
- The script reads tabs **'Tiger - US Markets'** and **'IBKR - US Markets'** via
  `getDataRange().getValues()` and returns rows + totals + snapshot label as JSON.
- Realised P/L comes from the sheet's **totals row**, not a row sum
  (Tiger row-sum realised is ~$7,219; the sheet total is $14,249.61).
