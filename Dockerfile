# TrackMyHappiness — Unified Production Container
# Builds BOTH the Expo Web/PWA bundle and the Node 24 tracking backend into one slim image.

FROM node:24-slim AS mobile-build
WORKDIR /app/mobile
COPY mobile/package*.json ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
COPY mobile/ ./
ENV EXPO_NO_TELEMETRY=1
RUN npx expo export --platform web

FROM node:24-slim AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci || npm install
COPY backend/ ./
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/trackmyhappiness.db
ENV WEB_DIST_DIR=/app/mobile/dist
ENV TRACKING_PROVIDER=free_direct
ENV SEED_DEMO_PARCELS=false

COPY backend/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY --from=backend-build /app/backend/dist ./dist
COPY --from=mobile-build /app/mobile/dist /app/mobile/dist

RUN mkdir -p /data

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
