# Shipping TrackMyHappiness on Vercel + Android APK ($0 Stack) 🚀

## 1. Deploy Everything to Vercel (Free Hobby Plan — $0)

TrackMyHappiness is configured for **single-project full-stack Vercel deployment** via `vercel.json`:
- **Frontend (Expo Web App):** Served globally from `mobile/dist` on Vercel CDN
- **Backend API (`/api/*`):** Runs as a Vercel Serverless Function (`api/index.mjs`)
- **Automatic Persistent Database:** Uses PostgreSQL automatically whenever `DATABASE_URL` or `POSTGRES_URL` is set (supports Vercel's 1-click free **Neon Postgres** storage!)

### Deploy via Vercel Dashboard (Recommended — Auto-Deploys on Every Git Push)
1. Open **[vercel.com/new](https://vercel.com/new)** and sign in with GitHub (`Shreyanskumarsingh20`).
2. Import **`Shreyanskumarsingh20/TrackMyHappiness`** and click **Deploy** (Vercel reads `vercel.json` automatically).
3. **Add Free Persistent Database (So Parcels Never Reset!):**
   - Inside your new Vercel project → **Storage** tab → **Create Database** → pick **Neon (Serverless Postgres — Free 0.5 GB)** → connect it to your project.
   - Vercel automatically injects `DATABASE_URL` / `POSTGRES_URL` — click **Redeploy** once and verify `/api/health` shows `"storage": "postgres-persistent"`.
4. **Optional 30-Minute 24/7 Background Polling ($0 via GitHub Actions):**
   - Vercel Hobby runs the built-in daily cron (`0 8 * * *`) automatically.
   - For **every-30-minute** checks 24/7 at $0: in your GitHub repo go to **Settings → Secrets and variables → Actions → Variables** → add `APP_URL` = `https://<your-vercel-domain>.vercel.app`. `.github/workflows/poll-parcels.yml` runs automatically!

### Or Deploy Directly via CLI
```powershell
vercel login
vercel --prod
```

---

## 2. Build & Install Your Permanent Android `.apk` (Free via Expo EAS)

Once your Vercel URL is live (e.g. `https://track-my-happiness.vercel.app`):
1. Set `EXPO_PUBLIC_API_URL` in `mobile/eas.json` under `build.preview.env` to your Vercel URL.
2. Run:
   ```powershell
   cd mobile
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```
3. Scan the QR code EAS prints to install **TrackMyHappiness** permanently on your Android phone (with real push notifications and your custom icon—no Expo Go needed!).

---

## 3. Optional $0 Global Coverage Expansion
- Out of the box, **Free Live Direct** tracks **Japan Post** and **Cainiao / China cross-border** parcels live with 0 keys + 1-tap official carrier links on every courier.
- For ~200 global couriers (FedEx, UPS, USPS, DHL, Royal Mail, India Post, Blue Dart, etc.), get a free **WhereParcel** key at [whereparcel.com](https://whereparcel.com) (**1,000 trackings/month free forever, no credit card**) and paste it into **Settings → WhereParcel**.
