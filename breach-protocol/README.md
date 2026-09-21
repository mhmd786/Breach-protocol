<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1c171246-e08b-49a3-af4a-c22259ecf5bc

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Playing Online With Friends

The app is a single Node process (`server.ts`): it serves the game *and* runs
the multiplayer WebSocket rooms on the same port, and the client always
connects back to whatever host loaded the page. That means it has to be
deployed as one combined, always-running service — not split across a
static host and separate serverless functions.

### Option A — quick, temporary, no deployment (good for a one-off game night)

1. Build and run it locally:
   ```
   npm run build
   npm run start
   ```
   This starts the game at `http://localhost:3000`.
2. In a second terminal, expose it with a tunnel, e.g. [ngrok](https://ngrok.com):
   ```
   ngrok http 3000
   ```
3. Send friends the `https://xxxx.ngrok-free.app` URL it prints. They open it,
   type in the same Room ID as you, and pick a side. Close the tunnel/server
   when you're done — nothing is left running.

### Option B — a real always-on server (Render.com)

This repo includes a `render.yaml` blueprint, so Render can set the service up
for you automatically:

1. Push this project to a GitHub repo.
2. On [render.com](https://render.com), choose **New → Blueprint**, and point
   it at your repo. Render will read `render.yaml` and configure:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
   - `NODE_ENV=production`
   - A `PORT` env var, which `server.ts` already reads dynamically.
3. Deploy. Render gives you a permanent URL like
   `https://breach-protocol.onrender.com` — share that (plus a Room ID) with
   friends, no port forwarding needed.
4. Note: Render's free plan sleeps the service after 15 minutes of no
   traffic, so the first request after idle takes ~30s to wake back up.
   Their cheapest paid tier removes that if it's annoying. Railway.app and
   Fly.io work the same way if you'd rather use one of those instead —
   same build/start commands, same idea (one persistent Node process).

**Do not deploy this to Vercel/Netlify as configured** — `vercel.json` in
this repo only runs `vite build` (the static frontend). Those platforms'
default hosting doesn't run a persistent WebSocket server, so the page would
load but multiplayer rooms would never connect.

