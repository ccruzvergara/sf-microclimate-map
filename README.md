# SF Microclimate Map

A lightweight web app that shows San Francisco neighborhood microclimates on an interactive map using:
- `https://microclimates.solofounders.com/neighborhoods`
- `https://microclimates.solofounders.com/location?lat=...&lng=...`

## Run

Because this is a static app, you can open `index.html` directly in a browser.

For best compatibility, serve it locally with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy To Vercel

### Option 1: Fastest (Web Dashboard)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo (or drag this folder in the dashboard flow)
3. Framework preset: `Other`
4. Build command: leave empty
5. Output directory: leave empty
6. Deploy

### Option 2: CLI

If you have Node installed locally:

```bash
npm i -g vercel
vercel login
vercel --prod
```
