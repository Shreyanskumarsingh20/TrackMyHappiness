import crypto from 'node:crypto';
import { Pool } from 'pg';
import { envConfig } from '../config.js';
import { buildCarrierTrackingUrl } from '../services/carrierTrackingUrls.js';
import {
  AlertItem,
  AppSettings,
  EventImportance,
  ItemCategory,
  NotificationRules,
  Parcel,
  ParcelStage,
  ProviderApiKeys,
  SimulatedCheckpoint,
  TrackingEvent,
  TrackingProviderId,
} from '../types.js';
import { DEFAULT_NOTIFICATION_RULES } from './store.js';
import { CreateParcelRecord, IAppStore, UpdateParcelPatch } from './types.js';

export class PostgresStore implements IAppStore {
  readonly storageKind = 'postgres-persistent' as const;
  private pool: Pool;
  private initPromise: Promise<void> | null = null;

  constructor(connectionString: string) {
    const needsSsl =
      !/localhost|127\.0\.0\.1/i.test(connectionString) && !/sslmode=disable/i.test(connectionString);
    this.pool = new Pool({
      connectionString,
      max: 5,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initSchema();
    }
    return this.initPromise;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS parcels (
        id TEXT PRIMARY KEY,
        awb TEXT NOT NULL,
        carrier_code TEXT NOT NULL,
        carrier_name TEXT NOT NULL,
        item_title TEXT NOT NULL,
        item_category TEXT NOT NULL DEFAULT 'other',
        item_emoji TEXT NOT NULL DEFAULT '📦',
        merchant TEXT NOT NULL DEFAULT '',
        item_notes TEXT NOT NULL DEFAULT '',
        item_image_url TEXT NOT NULL DEFAULT '',
        order_url TEXT NOT NULL DEFAULT '',
        origin_country TEXT NOT NULL DEFAULT 'International',
        origin_flag TEXT NOT NULL DEFAULT '🌍',
        destination_country TEXT NOT NULL DEFAULT 'India',
        destination_flag TEXT NOT NULL DEFAULT '🇮🇳',
        status TEXT NOT NULL DEFAULT 'pending',
        status_summary TEXT NOT NULL DEFAULT '',
        estimated_delivery TEXT,
        last_location TEXT NOT NULL DEFAULT '',
        last_event_at TEXT,
        provider_used TEXT NOT NULL DEFAULT 'free_direct',
        provider_tracking_id TEXT,
        simulator_stage INTEGER NOT NULL DEFAULT -1,
        simulator_route_json TEXT,
        muted BOOLEAN NOT NULL DEFAULT FALSE,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_parcels_awb ON parcels(awb);
      CREATE INDEX IF NOT EXISTS idx_parcels_archived ON parcels(archived);

      CREATE TABLE IF NOT EXISTS tracking_events (
        seq BIGSERIAL,
        id TEXT PRIMARY KEY,
        parcel_id TEXT NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
        event_hash TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        country_code TEXT,
        raw_description TEXT NOT NULL,
        friendly_title TEXT NOT NULL,
        friendly_summary TEXT NOT NULL,
        stage TEXT NOT NULL,
        importance TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(parcel_id, event_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_events_parcel ON tracking_events(parcel_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        parcel_id TEXT NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
        event_id TEXT,
        importance TEXT NOT NULL,
        stage TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        push_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

      CREATE TABLE IF NOT EXISTS push_tokens (
        token TEXT PRIMARY KEY,
        platform TEXT NOT NULL DEFAULT 'unknown',
        device_name TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );
    `);
  }

  private mapParcelRow(row: Record<string, unknown>): Parcel {
    let route: SimulatedCheckpoint[] | null = null;
    if (typeof row.simulator_route_json === 'string' && row.simulator_route_json) {
      try {
        route = JSON.parse(row.simulator_route_json) as SimulatedCheckpoint[];
      } catch {
        route = null;
      }
    }
    const awb = String(row.awb);
    const carrierCode = String(row.carrier_code);
    return {
      id: String(row.id),
      awb,
      carrierCode,
      carrierName: String(row.carrier_name),
      carrierTrackingUrl: buildCarrierTrackingUrl(carrierCode, awb),
      itemTitle: String(row.item_title),
      itemCategory: String(row.item_category) as ItemCategory,
      itemEmoji: String(row.item_emoji),
      merchant: String(row.merchant ?? ''),
      itemNotes: String(row.item_notes ?? ''),
      itemImageUrl: String(row.item_image_url ?? ''),
      orderUrl: String(row.order_url ?? ''),
      originCountry: String(row.origin_country ?? 'International'),
      originFlag: String(row.origin_flag ?? '🌍'),
      destinationCountry: String(row.destination_country ?? 'India'),
      destinationFlag: String(row.destination_flag ?? '🇮🇳'),
      status: String(row.status) as ParcelStage,
      statusSummary: String(row.status_summary ?? ''),
      estimatedDelivery: row.estimated_delivery ? String(row.estimated_delivery) : null,
      lastLocation: String(row.last_location ?? ''),
      lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
      providerUsed: String(row.provider_used) as TrackingProviderId,
      providerTrackingId: row.provider_tracking_id ? String(row.provider_tracking_id) : null,
      simulatorStage: Number(row.simulator_stage ?? -1),
      simulatorRoute: route,
      muted: Boolean(row.muted),
      archived: Boolean(row.archived),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapEventRow(row: Record<string, unknown>): TrackingEvent {
    return {
      id: String(row.id),
      parcelId: String(row.parcel_id),
      eventHash: String(row.event_hash),
      occurredAt: String(row.occurred_at),
      location: String(row.location ?? ''),
      countryCode: row.country_code ? String(row.country_code) : null,
      rawDescription: String(row.raw_description),
      friendlyTitle: String(row.friendly_title),
      friendlySummary: String(row.friendly_summary),
      stage: String(row.stage) as ParcelStage,
      importance: String(row.importance) as EventImportance,
      createdAt: String(row.created_at),
    };
  }

  private mapAlertRow(row: Record<string, unknown>): AlertItem {
    return {
      id: String(row.id),
      parcelId: String(row.parcel_id),
      parcelTitle: String(row.parcel_title ?? 'Parcel'),
      parcelEmoji: String(row.parcel_emoji ?? '📦'),
      parcelAwb: String(row.parcel_awb ?? ''),
      carrierName: String(row.carrier_name ?? ''),
      eventId: row.event_id ? String(row.event_id) : null,
      importance: String(row.importance) as EventImportance,
      stage: String(row.stage) as ParcelStage,
      title: String(row.title),
      body: String(row.body),
      isRead: Boolean(row.is_read),
      pushSent: Boolean(row.push_sent),
      createdAt: String(row.created_at),
    };
  }

  async countParcels(): Promise<number> {
    await this.init();
    const res = await this.pool.query('SELECT COUNT(*)::int AS c FROM parcels');
    return Number(res.rows[0]?.c ?? 0);
  }

  async listParcels(options?: { includeArchived?: boolean }): Promise<Parcel[]> {
    await this.init();
    const includeArchived = options?.includeArchived ?? false;
    const res = includeArchived
      ? await this.pool.query('SELECT * FROM parcels ORDER BY updated_at DESC')
      : await this.pool.query('SELECT * FROM parcels WHERE archived = FALSE ORDER BY updated_at DESC');

    const parcels: Parcel[] = [];
    for (const row of res.rows) {
      const parcel = this.mapParcelRow(row);
      const unreadRes = await this.pool.query(
        'SELECT COUNT(*)::int AS c FROM alerts WHERE parcel_id = $1 AND is_read = FALSE',
        [parcel.id]
      );
      parcel.unreadAlertsCount = Number(unreadRes.rows[0]?.c ?? 0);
      parcel.events = await this.getEventsForParcel(parcel.id, 3);
      parcels.push(parcel);
    }
    return parcels;
  }

  async listActiveParcelsForPolling(): Promise<Parcel[]> {
    await this.init();
    const res = await this.pool.query(
      `SELECT * FROM parcels
       WHERE archived = FALSE
         AND status NOT IN ('delivered', 'expired')
         AND provider_used != 'simulator'
       ORDER BY updated_at ASC`
    );
    return res.rows.map((r) => this.mapParcelRow(r));
  }

  async getParcelById(id: string): Promise<Parcel | null> {
    await this.init();
    const res = await this.pool.query('SELECT * FROM parcels WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const parcel = this.mapParcelRow(res.rows[0]);
    parcel.events = await this.getEventsForParcel(id);
    const unreadRes = await this.pool.query(
      'SELECT COUNT(*)::int AS c FROM alerts WHERE parcel_id = $1 AND is_read = FALSE',
      [id]
    );
    parcel.unreadAlertsCount = Number(unreadRes.rows[0]?.c ?? 0);
    return parcel;
  }

  async getParcelByAwb(awb: string): Promise<Parcel | null> {
    await this.init();
    const res = await this.pool.query(
      'SELECT * FROM parcels WHERE UPPER(awb) = UPPER($1) AND archived = FALSE LIMIT 1',
      [awb]
    );
    return res.rows[0] ? this.mapParcelRow(res.rows[0]) : null;
  }

  async createParcel(parcel: CreateParcelRecord): Promise<Parcel> {
    await this.init();
    await this.pool.query(
      `INSERT INTO parcels (
        id, awb, carrier_code, carrier_name, item_title, item_category, item_emoji,
        merchant, item_notes, item_image_url, order_url,
        origin_country, origin_flag, destination_country, destination_flag,
        status, status_summary, estimated_delivery, last_location, last_event_at,
        provider_used, provider_tracking_id, simulator_stage, simulator_route_json,
        muted, archived, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
      )`,
      [
        parcel.id,
        parcel.awb,
        parcel.carrierCode,
        parcel.carrierName,
        parcel.itemTitle,
        parcel.itemCategory,
        parcel.itemEmoji,
        parcel.merchant,
        parcel.itemNotes,
        parcel.itemImageUrl,
        parcel.orderUrl,
        parcel.originCountry,
        parcel.originFlag,
        parcel.destinationCountry,
        parcel.destinationFlag,
        parcel.status,
        parcel.statusSummary,
        parcel.estimatedDelivery,
        parcel.lastLocation,
        parcel.lastEventAt,
        parcel.providerUsed,
        parcel.providerTrackingId,
        parcel.simulatorStage,
        parcel.simulatorRoute ? JSON.stringify(parcel.simulatorRoute) : null,
        parcel.muted,
        parcel.archived,
        parcel.createdAt,
        parcel.updatedAt,
      ]
    );
    return (await this.getParcelById(parcel.id))!;
  }

  async updateParcel(id: string, patch: UpdateParcelPatch): Promise<Parcel | null> {
    await this.init();
    const existing = await this.getParcelById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    await this.pool.query(
      `UPDATE parcels SET
        carrier_code = $1, carrier_name = $2,
        item_title = $3, item_category = $4, item_emoji = $5,
        merchant = $6, item_notes = $7, item_image_url = $8, order_url = $9,
        origin_country = $10, origin_flag = $11, destination_country = $12, destination_flag = $13,
        status = $14, status_summary = $15, estimated_delivery = $16, last_location = $17, last_event_at = $18,
        provider_used = $19, provider_tracking_id = $20, simulator_stage = $21, simulator_route_json = $22,
        muted = $23, archived = $24, updated_at = $25
      WHERE id = $26`,
      [
        patch.carrierCode ?? existing.carrierCode,
        patch.carrierName ?? existing.carrierName,
        patch.itemTitle ?? existing.itemTitle,
        patch.itemCategory ?? existing.itemCategory,
        patch.itemEmoji ?? existing.itemEmoji,
        patch.merchant ?? existing.merchant,
        patch.itemNotes ?? existing.itemNotes,
        patch.itemImageUrl ?? existing.itemImageUrl,
        patch.orderUrl ?? existing.orderUrl,
        patch.originCountry ?? existing.originCountry,
        patch.originFlag ?? existing.originFlag,
        patch.destinationCountry ?? existing.destinationCountry,
        patch.destinationFlag ?? existing.destinationFlag,
        patch.status ?? existing.status,
        patch.statusSummary ?? existing.statusSummary,
        patch.estimatedDelivery !== undefined ? patch.estimatedDelivery : existing.estimatedDelivery,
        patch.lastLocation ?? existing.lastLocation,
        patch.lastEventAt !== undefined ? patch.lastEventAt : existing.lastEventAt,
        patch.providerUsed ?? existing.providerUsed,
        patch.providerTrackingId !== undefined ? patch.providerTrackingId : existing.providerTrackingId,
        patch.simulatorStage !== undefined ? patch.simulatorStage : existing.simulatorStage,
        patch.simulatorRoute !== undefined
          ? patch.simulatorRoute
            ? JSON.stringify(patch.simulatorRoute)
            : null
          : existing.simulatorRoute
          ? JSON.stringify(existing.simulatorRoute)
          : null,
        patch.muted !== undefined ? patch.muted : existing.muted,
        patch.archived !== undefined ? patch.archived : existing.archived,
        now,
        id,
      ]
    );

    if (patch.itemTitle && patch.itemTitle !== existing.itemTitle) {
      const alertsRes = await this.pool.query('SELECT id, title, body FROM alerts WHERE parcel_id = $1', [id]);
      for (const a of alertsRes.rows) {
        const nextTitle = String(a.title).replaceAll(existing.itemTitle, patch.itemTitle);
        const nextBody = String(a.body).replaceAll(existing.itemTitle, patch.itemTitle);
        if (nextTitle !== a.title || nextBody !== a.body) {
          await this.pool.query('UPDATE alerts SET title = $1, body = $2 WHERE id = $3', [
            nextTitle,
            nextBody,
            String(a.id),
          ]);
        }
      }
    }

    return this.getParcelById(id);
  }

  async deleteParcel(id: string): Promise<boolean> {
    await this.init();
    const res = await this.pool.query('DELETE FROM parcels WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getEventsForParcel(parcelId: string, limit?: number): Promise<TrackingEvent[]> {
    await this.init();
    const res = limit
      ? await this.pool.query(
          'SELECT * FROM tracking_events WHERE parcel_id = $1 ORDER BY occurred_at DESC, seq DESC LIMIT $2',
          [parcelId, limit]
        )
      : await this.pool.query(
          'SELECT * FROM tracking_events WHERE parcel_id = $1 ORDER BY occurred_at DESC, seq DESC',
          [parcelId]
        );
    return res.rows.map((r) => this.mapEventRow(r));
  }

  async insertEventIfNew(event: Omit<TrackingEvent, 'id' | 'eventHash' | 'createdAt'>): Promise<{
    inserted: boolean;
    event: TrackingEvent | null;
  }> {
    await this.init();
    const dayBucket = event.occurredAt.slice(0, 10);
    const hashInput = `${event.parcelId}|${dayBucket}|${event.rawDescription.toLowerCase().trim()}|${event.location
      .toLowerCase()
      .trim()}|${event.stage}`;
    const eventHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 24);

    const existingRes = await this.pool.query(
      'SELECT * FROM tracking_events WHERE parcel_id = $1 AND event_hash = $2',
      [event.parcelId, eventHash]
    );

    if (existingRes.rows[0]) {
      const existing = existingRes.rows[0];
      if (new Date(event.occurredAt).getTime() > new Date(String(existing.occurred_at)).getTime()) {
        await this.pool.query('UPDATE tracking_events SET occurred_at = $1 WHERE id = $2', [
          event.occurredAt,
          String(existing.id),
        ]);
        existing.occurred_at = event.occurredAt;
      }
      return { inserted: false, event: this.mapEventRow(existing) };
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO tracking_events (
        id, parcel_id, event_hash, occurred_at, location, country_code,
        raw_description, friendly_title, friendly_summary, stage, importance, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        event.parcelId,
        eventHash,
        event.occurredAt,
        event.location,
        event.countryCode,
        event.rawDescription,
        event.friendlyTitle,
        event.friendlySummary,
        event.stage,
        event.importance,
        createdAt,
      ]
    );

    return {
      inserted: true,
      event: { id, eventHash, createdAt, ...event },
    };
  }

  async createAlert(input: {
    parcelId: string;
    eventId: string | null;
    importance: EventImportance;
    stage: ParcelStage;
    title: string;
    body: string;
    pushSent: boolean;
  }): Promise<AlertItem> {
    await this.init();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO alerts (id, parcel_id, event_id, importance, stage, title, body, is_read, push_sent, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9)`,
      [id, input.parcelId, input.eventId, input.importance, input.stage, input.title, input.body, input.pushSent, createdAt]
    );
    return (await this.getAlertById(id))!;
  }

  async getAlertById(id: string): Promise<AlertItem | null> {
    await this.init();
    const res = await this.pool.query(
      `SELECT a.*, p.item_title AS parcel_title, p.item_emoji AS parcel_emoji, p.awb AS parcel_awb, p.carrier_name
       FROM alerts a
       JOIN parcels p ON p.id = a.parcel_id
       WHERE a.id = $1`,
      [id]
    );
    return res.rows[0] ? this.mapAlertRow(res.rows[0]) : null;
  }

  async listAlerts(options?: { importantOnly?: boolean; limit?: number }): Promise<AlertItem[]> {
    await this.init();
    const limit = options?.limit ?? 80;
    const sql = options?.importantOnly
      ? `SELECT a.*, p.item_title AS parcel_title, p.item_emoji AS parcel_emoji, p.awb AS parcel_awb, p.carrier_name
         FROM alerts a
         JOIN parcels p ON p.id = a.parcel_id
         WHERE a.importance IN ('critical', 'important')
         ORDER BY a.created_at DESC LIMIT $1`
      : `SELECT a.*, p.item_title AS parcel_title, p.item_emoji AS parcel_emoji, p.awb AS parcel_awb, p.carrier_name
         FROM alerts a
         JOIN parcels p ON p.id = a.parcel_id
         ORDER BY a.created_at DESC LIMIT $1`;
    const res = await this.pool.query(sql, [limit]);
    return res.rows.map((r) => this.mapAlertRow(r));
  }

  async getUnreadAlertsCount(): Promise<number> {
    await this.init();
    const res = await this.pool.query('SELECT COUNT(*)::int AS c FROM alerts WHERE is_read = FALSE');
    return Number(res.rows[0]?.c ?? 0);
  }

  async markAlertRead(id: string): Promise<void> {
    await this.init();
    await this.pool.query('UPDATE alerts SET is_read = TRUE WHERE id = $1', [id]);
  }

  async markAllAlertsRead(): Promise<void> {
    await this.init();
    await this.pool.query('UPDATE alerts SET is_read = TRUE WHERE is_read = FALSE');
  }

  async markParcelAlertsRead(parcelId: string): Promise<void> {
    await this.init();
    await this.pool.query('UPDATE alerts SET is_read = TRUE WHERE parcel_id = $1 AND is_read = FALSE', [parcelId]);
  }

  async savePushToken(token: string, platform = 'unknown', deviceName = ''): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO push_tokens (token, platform, device_name, updated_at)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT(token) DO UPDATE SET platform = EXCLUDED.platform, device_name = EXCLUDED.device_name, updated_at = EXCLUDED.updated_at`,
      [token, platform, deviceName, now]
    );
  }

  async listPushTokens(): Promise<string[]> {
    await this.init();
    const res = await this.pool.query('SELECT token FROM push_tokens');
    return res.rows.map((r) => String(r.token));
  }

  private async getSettingValue<T>(key: string, fallback: T): Promise<T> {
    await this.init();
    const res = await this.pool.query('SELECT value_json FROM settings WHERE key = $1', [key]);
    const raw = res.rows[0]?.value_json;
    if (typeof raw !== 'string') return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async setSettingValue(key: string, value: unknown): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO settings (key, value_json) VALUES ($1, $2)
       ON CONFLICT(key) DO UPDATE SET value_json = EXCLUDED.value_json`,
      [key, JSON.stringify(value)]
    );
  }

  async getProviderApiKeys(): Promise<ProviderApiKeys> {
    const saved = await this.getSettingValue<ProviderApiKeys>('provider_api_keys', {});
    return {
      whereparcel: saved.whereparcel || envConfig.apiKeys.whereparcel || '',
      dhl: saved.dhl || envConfig.apiKeys.dhl || '',
      '17track': saved['17track'] || envConfig.apiKeys['17track'] || '',
      ship24: saved.ship24 || envConfig.apiKeys.ship24 || '',
      trackingmore: saved.trackingmore || envConfig.apiKeys.trackingmore || '',
    };
  }

  async getSettings(): Promise<AppSettings> {
    const keys = await this.getProviderApiKeys();
    const activeProvider = await this.getSettingValue<TrackingProviderId>(
      'active_provider',
      envConfig.defaultProvider
    );
    const pollIntervalMinutes = await this.getSettingValue<number>(
      'poll_interval_minutes',
      envConfig.pollIntervalMinutes
    );
    const defaultDestinationCountry = await this.getSettingValue<string>(
      'default_destination_country',
      envConfig.defaultDestinationCountry
    );
    const notificationRules = {
      ...DEFAULT_NOTIFICATION_RULES,
      ...(await this.getSettingValue<Partial<NotificationRules>>('notification_rules', {})),
    };

    return {
      activeProvider,
      pollIntervalMinutes,
      defaultDestinationCountry,
      notificationRules,
      configuredProviders: {
        free_direct: true,
        whereparcel: Boolean(keys.whereparcel),
        dhl: Boolean(keys.dhl),
        simulator: true,
        '17track': Boolean(keys['17track']),
        ship24: Boolean(keys.ship24),
        trackingmore: Boolean(keys.trackingmore),
      },
    };
  }

  async updateSettings(patch: {
    activeProvider?: TrackingProviderId;
    pollIntervalMinutes?: number;
    defaultDestinationCountry?: string;
    notificationRules?: Partial<NotificationRules>;
    apiKeys?: Partial<ProviderApiKeys>;
  }): Promise<AppSettings> {
    if (patch.activeProvider) {
      await this.setSettingValue('active_provider', patch.activeProvider);
    }
    if (patch.pollIntervalMinutes !== undefined) {
      await this.setSettingValue('poll_interval_minutes', Math.max(5, Math.min(720, patch.pollIntervalMinutes)));
    }
    if (patch.defaultDestinationCountry) {
      await this.setSettingValue('default_destination_country', patch.defaultDestinationCountry.trim());
    }
    if (patch.notificationRules) {
      const current = (await this.getSettings()).notificationRules;
      await this.setSettingValue('notification_rules', { ...current, ...patch.notificationRules });
    }
    if (patch.apiKeys) {
      const currentKeys = await this.getSettingValue<ProviderApiKeys>('provider_api_keys', {});
      const nextKeys: ProviderApiKeys = { ...currentKeys };
      if (patch.apiKeys.whereparcel !== undefined) nextKeys.whereparcel = patch.apiKeys.whereparcel.trim();
      if (patch.apiKeys.dhl !== undefined) nextKeys.dhl = patch.apiKeys.dhl.trim();
      if (patch.apiKeys['17track'] !== undefined) nextKeys['17track'] = patch.apiKeys['17track'].trim();
      if (patch.apiKeys.ship24 !== undefined) nextKeys.ship24 = patch.apiKeys.ship24.trim();
      if (patch.apiKeys.trackingmore !== undefined) nextKeys.trackingmore = patch.apiKeys.trackingmore.trim();
      await this.setSettingValue('provider_api_keys', nextKeys);
    }
    return this.getSettings();
  }
}
