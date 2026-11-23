import { AppStore } from '../db/store.js';
import { AlertItem, NotificationRules, Parcel, TrackingEvent } from '../types.js';

export function shouldNotifyForEvent(
  event: TrackingEvent,
  rules: NotificationRules,
  parcelMuted: boolean
): boolean {
  if (parcelMuted) return false;

  if (event.importance === 'minor' && rules.muteMinorHubScans) {
    return false;
  }

  switch (event.stage) {
    case 'exception':
      return rules.notifyOnException;
    case 'delivered':
      return rules.notifyOnDelivered;
    case 'out_for_delivery':
      return rules.notifyOnOutForDelivery;
    case 'customs':
      return rules.notifyOnCustoms;
    case 'in_transit': {
      const lowerTitle = event.friendlyTitle.toLowerCase();
      if (lowerTitle.includes('picked up')) return rules.notifyOnShipped;
      if (lowerTitle.includes('destination country') || lowerTitle.includes('departed origin')) {
        return rules.notifyOnInternationalArrival;
      }
      if (event.importance === 'important') return true;
      return !rules.muteMinorHubScans;
    }
    case 'info_received':
      return !rules.muteMinorHubScans;
    default:
      return event.importance !== 'minor';
  }
}

export function buildHumanNotification(parcel: Parcel, event: TrackingEvent): { title: string; body: string } {
  const what = parcel.itemTitle;
  const fromMerchant = parcel.merchant ? ` from ${parcel.merchant}` : '';
  const emoji = parcel.itemEmoji || '📦';

  switch (event.stage) {
    case 'out_for_delivery':
      return {
        title: `🚚 Out for Delivery: ${emoji} ${what}`,
        body: `Your ${parcel.carrierName} parcel${fromMerchant} is out for delivery${
          event.location ? ` in ${event.location}` : ''
        } — arriving today!`,
      };
    case 'delivered':
      return {
        title: `🎉 Delivered: ${emoji} ${what}`,
        body: `Happiness arrived! Your ${what}${fromMerchant} (${parcel.carrierName}) has been delivered${
          event.location ? ` in ${event.location}` : ''
        }.`,
      };
    case 'customs':
      if (event.importance === 'critical') {
        return {
          title: `⚠️ Customs Attention: ${emoji} ${what}`,
          body: `${event.friendlySummary} (AWB ${parcel.awb})`,
        };
      }
      return {
        title: `🛃 ${event.friendlyTitle}: ${emoji} ${what}`,
        body: `${event.friendlySummary} (${parcel.carrierName})`,
      };
    case 'exception':
      return {
        title: `🚨 Action Needed: ${emoji} ${what}`,
        body: `${event.friendlySummary} (${parcel.carrierName} • ${parcel.awb})`,
      };
    default:
      return {
        title: `${emoji} ${what} — ${event.friendlyTitle}`,
        body: `${event.friendlySummary}${fromMerchant ? ` • ${parcel.merchant}` : ''}`,
      };
  }
}

export class NotificationService {
  constructor(private store: AppStore) {}

  async emitUpdateIfImportant(
    parcel: Parcel,
    event: TrackingEvent,
    options?: { suppressPush?: boolean }
  ): Promise<AlertItem | null> {
    const settings = this.store.getSettings();
    const shouldAlert = shouldNotifyForEvent(event, settings.notificationRules, parcel.muted);
    if (!shouldAlert) return null;

    const { title, body } = buildHumanNotification(parcel, event);
    let pushSent = false;

    if (!options?.suppressPush) {
      pushSent = await this.sendExpoPush(title, body, {
        parcelId: parcel.id,
        awb: parcel.awb,
        stage: event.stage,
      });
    }

    return this.store.createAlert({
      parcelId: parcel.id,
      eventId: event.id,
      importance: event.importance,
      stage: event.stage,
      title,
      body,
      pushSent,
    });
  }

  private async sendExpoPush(
    title: string,
    body: string,
    data: Record<string, unknown>
  ): Promise<boolean> {
    const tokens = this.store
      .listPushTokens()
      .filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

    if (tokens.length === 0) return false;

    try {
      const messages = tokens.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
      }));

      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      return resp.ok;
    } catch {
      return false;
    }
  }
}
