# Shipping TrackMyHappiness v1.0.0 🚀

This guide walks you through shipping **both** halves of TrackMyHappiness:
1. Your **24/7 Tracking Backend + Web App** (runs continuously in the cloud so your AWBs stay watched and push notifications arrive even when your laptop is off).
2. Your **Installable Android `.apk`** (built free via Expo EAS Build — install directly on your Android phone with real push alerts, zero Google Play fee).

---

## Step 1 — Push Repo to GitHub

Your project is already initialized as a clean Git repository (`v1.0.0`) with secrets (`backend/.env`, SQLite DBs) excluded via `.gitignore`.

```powershell
git remote add origin https://github.com/<your-username>/TrackMyHappiness.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy the 24/7 Backend + Web App

Because `Dockerfile` bundles **both** the Node.js 24 backend and the compiled Expo Web App (`mobile/dist`), deploying this single container gives you:
- `https://<your-app-url>/` → Full mobile-friendly Web App (installable to iPhone/Android home screen!)
- `https://<your-app-url>/api/*` → 24/7 AWB watcher, webhooks, and push notification engine

### Option A: Render (1-Click Blueprint via `render.yaml`)
1. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance** → select your GitHub repo.
2. Render automatically reads `render.yaml`, builds `Dockerfile`, and attaches a persistent `/data` disk for SQLite.
3. Note your live URL (e.g., `https://trackmyhappiness.onrender.com`).

### Option B: Fly.io (via `fly.toml` — Mumbai `bom` region pre-configured)
```powershell
fly auth login
fly apps create trackmyhappiness-app
fly volumes create tmh_data --region bom --size 1
fly deploy
```

### Option C: Google Cloud Run (Docker) or Any VPS
```powershell
docker build -t trackmyhappiness:1.0.0 .
docker run -d -p 4000:4000 -v tmh_data:/data --name trackmyhappiness trackmyhappiness:1.0.0
```
*(Note: For serverless hosts with ephemeral local disks like Cloud Run, mount a persistent Cloud Storage FUSE / volume at `/data` or switch to a cloud DB so tracked parcels persist across cold starts.)*

---

## Step 3 — Build & Install the Android `.apk` (Free via Expo EAS)

1. Create a free Expo account at [expo.dev](https://expo.dev) (no credit card needed).
2. Point the Android APK to your deployed 24/7 backend URL by setting `EXPO_PUBLIC_API_URL` in `mobile/eas.json` under `build.preview.env`:
   ```json
   "EXPO_PUBLIC_API_URL": "https://trackmyhappiness.onrender.com"
   ```
   *(You can also change the backend URL anytime inside the app under **Settings → Backend Server URL**.)*
3. Run the free cloud build from `mobile/`:
   ```powershell
   cd mobile
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```
4. When EAS finishes (~5–8 minutes), it gives you a **download link & QR code** for your signed `.apk`. Scan it on your Android phone, install TrackMyHappiness, allow Notifications, and you're live!

---

## Step 4 — Optional \$0 Coverage Expansion (No Subscription)

Out of the box, **Free Live Direct** tracks **Japan Post** (`LP...JP`, `RR...JP`, etc.) and **Cainiao / China cross-border** parcels live with **zero keys**, and gives a 1-tap **Open Live Carrier Page** button on every courier.

To unlock automatic background tracking for **~200 worldwide couriers** (FedEx, UPS, USPS, DHL, Royal Mail, India Post, Blue Dart, etc.) at **\$0**:
1. Create a free account at [whereparcel.com](https://whereparcel.com) (**1,000 trackings/month free forever, no credit card**).
2. Open TrackMyHappiness → **Settings** → select **WhereParcel Free Tier** → paste `API_KEY:SECRET_KEY` → tap **Save Tracking Engine**.
