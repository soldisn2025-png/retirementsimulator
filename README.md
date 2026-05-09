# RetireMap

RetireMap is a hosted-friendly retirement planning simulator for comparing career and life scenarios through age 90.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## AI Advisor

Create `.env` for local development:

```bash
ANTHROPIC_API_KEY=your_key_here
```

The Vite dev server includes a local `/api/anthropic` proxy. In production, Vercel uses `api/anthropic.js`. In both cases, the API key stays out of browser code.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import it into Vercel on the Hobby/free plan.
3. Add `ANTHROPIC_API_KEY` in Vercel project environment variables.
4. Deploy.

No database or paid third-party service is required. Data is stored per device/browser.
