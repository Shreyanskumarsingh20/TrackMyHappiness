import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { envConfig } from './config.js';
import { createStore } from './db/index.js';
import { BackgroundScheduler } from './services/scheduler.js';
import { TrackerService } from './services/trackerService.js';

async function main() {
  const store = createStore();
  await store.init();
  const tracker = new TrackerService(store);

  if (envConfig.seedDemoParcels) {
    await tracker.seedWelcomeParcelsIfEmpty();
  }

  const scheduler = new BackgroundScheduler(store, tracker);
  await scheduler.start();

  const hasWebBundle = fs.existsSync(path.join(envConfig.webDistDir, 'index.html'));
  const app = createApp(store, tracker, scheduler, {
    webDistDir: hasWebBundle ? envConfig.webDistDir : undefined,
  });

  const server = app.listen(envConfig.port, envConfig.host, async () => {
    const settings = await store.getSettings();
    console.log(`\n✨ TrackMyHappiness Backend running at http://localhost:${envConfig.port}`);
    console.log(`   Mode            : ${envConfig.nodeEnv}`);
    console.log(`   Storage         : ${store.storageKind}`);
    console.log(`   Tracking Engine : ${settings.activeProvider}`);
    console.log(`   Auto-Poll Every : ${settings.pollIntervalMinutes} min`);
    if (hasWebBundle) {
      console.log(`   Web App Bundle  : Serving ${envConfig.webDistDir}`);
    }
    console.log('');
  });

  const shutdown = (signal: string) => {
    console.log(`\n[Server] Received ${signal} — shutting down cleanly...`);
    scheduler.stop();
    server.close(async () => {
      try {
        await store.close();
      } catch {
        // ignore
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start TrackMyHappiness backend:', err);
  process.exit(1);
});
