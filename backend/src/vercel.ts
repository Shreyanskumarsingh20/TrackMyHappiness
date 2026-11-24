import { createApp } from './app.js';
import { createStore, IAppStore } from './db/index.js';
import { TrackerService } from './services/trackerService.js';

let cachedApp: ReturnType<typeof createApp> | null = null;
let cachedStore: IAppStore | null = null;

function getServerlessApp() {
  if (!cachedApp) {
    cachedStore = createStore();
    const tracker = new TrackerService(cachedStore);
    cachedApp = createApp(cachedStore, tracker);
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  const app = getServerlessApp();
  if (cachedStore) {
    await cachedStore.init();
  }
  return app(req, res);
}
