import { IAppStore } from '../db/types.js';
import { TrackerService } from './trackerService.js';

export class BackgroundScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private store: IAppStore, private tracker: TrackerService) {}

  async start(): Promise<void> {
    this.stop();
    const settings = await this.store.getSettings();
    const intervalMin = Math.max(5, settings.pollIntervalMinutes);
    const intervalMs = intervalMin * 60_000;

    this.timer = setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        const result = await this.tracker.refreshAllActive();
        if (result.checked > 0) {
          console.log(
            `[Scheduler] Checked ${result.checked} active parcel(s); created ${result.newAlerts} important alert(s).`
          );
        }
      } catch (err) {
        console.error('[Scheduler] Background poll failed:', err);
      } finally {
        this.isRunning = false;
      }
    }, intervalMs);

    this.timer.unref();
  }

  restart(): void {
    void this.start();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
