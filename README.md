# TrackMyHappiness 📦✨

A mobile parcel tracker that lets you **drop any worldwide AWB (or paste an entire SMS / WhatsApp / order email)** and automatically tracks your parcels across the globe—keeping a crystal-clear picture of **what's coming** and alerting you **only on important milestones** (no more guessing which tracking code belongs to what!).

## What's Inside

- **Mobile App (`mobile/` — React Native + Expo + Expo Router)**
  - **What's Coming Dashboard**: Visual cards led by item emoji/photo, item name, store badge, origin → destination flags, personal note reminder, 5-step global journey bar, and ETA countdown.
  - **Smart Paste + Drop AWB**: Paste a messy SMS, WhatsApp forward, or order email—automatically extracts the AWB, auto-detects the carrier worldwide (DHL, UPS, FedEx, USPS, China Post, Japan Post, Royal Mail, Blue Dart, Delhivery, India Post, YunExpress, Cainiao, SF Express, etc.), store name, item title, category emoji, and ETA.
  - **Important Updates Inbox**: Human-readable alerts like *"🚚 Out for Delivery: 🎧 Sony WH-1000XM5 Headphones"*—automatically mutes noisy sorting-hub scans while alerting on international arrival, customs holds/clearance, out for delivery, delivery delays, and delivery confirmation.
  - **Built-in Demo Simulator**: Tap **"Simulate Next Milestone"** on any parcel to experience the entire global journey and live alerts right away.
- **Background Tracking Backend (`backend/` — Node.js + TypeScript + Express + built-in SQLite)**
  - **Pluggable Global Tracking Engines**: Built-in **Global Simulator** out of the box, plus ready-to-use live adapters & webhooks for **17TRACK** (2,500+ carriers), **Ship24** (1,500+ carriers), and **TrackingMore** (1,300+ carriers).
  - **Automatic Background Polling & Expo Push Notifications**: Watches active parcels on a schedule even when the mobile app is closed and dispatches push alerts to registered devices.

## Quick Start

### 1. Start the Tracking Backend

```bash
npm run dev:backend
```

Runs on `http://localhost:4000` (and creates a local SQLite database at `backend/data/trackmyhappiness.db` with 3 sample global parcels so you can explore right away).

### 2. Run the Mobile App

**Option A — Preview on your iPhone / Android phone (Expo Go):**

```bash
npm run dev:mobile
```

Scan the QR code with the **Expo Go** app (same Wi-Fi network as your PC). The app automatically detects your PC's LAN IP to talk to port `4000`, or you can customize the server URL in **Settings → Backend Server URL**.

**Option B — Preview instantly in your web browser:**

```bash
npm run dev:web
```

## \$0 / Zero-Subscription Live Tracking

TrackMyHappiness is designed to work **without any paid subscription**:

1. **Free Live Direct (Default — \$0, No API Key Needed):**
   - Live keyless lookups for **Japan Post** (`LP...JP`, `RR...JP`, `EJ...JP`, etc. — including overseas customs & delivery scans!) and **Cainiao / China cross-border** parcels (`LP...`, `YT...`, `CN`, `SY...`, `4PX...`, etc.).
   - Optional **free DHL Developer key** (`developer.dhl.com`) for live DHL Express tracking.
   - **1-Tap Official Carrier Page** button on every parcel pre-filled with your AWB as an instant fallback for CAPTCHA-gated couriers.
2. **WhereParcel Free Tier (\$0 Forever — 1,000 Trackings/Month, No Credit Card):**
   - Covers ~200 worldwide couriers (Japan Post, DHL, UPS, FedEx, USPS, Royal Mail, China Post, India Post, etc.) with webhooks included.
   - Grab a free key at [whereparcel.com](https://whereparcel.com), open **Settings → WhereParcel**, paste `API_KEY:SECRET_KEY`, and tap **Save Tracking Engine**.
3. **Optional Business Aggregators:** 17TRACK, Ship24, and TrackingMore are also supported if you ever need enterprise coverage.

## Running Tests & Type Checks

```bash
npm run test:backend
npm run typecheck:backend
npm run typecheck:mobile
```
