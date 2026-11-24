import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
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
import { CreateParcelRecord, IAppStore, UpdateParcelPatch } from './types.js';

interface SqliteStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

const require = createRequire(import.meta.url);

export const DEFAULT_NOTIFICATION_RULES: NotificationRules = {
  notifyOnShipped: true,
  notifyOnInternationalArrival: true,
  notifyOnCustoms: true,
  notifyOnOutForDelivery: true,
  notifyOnDelivered: true,
  notifyOnException: true,
  muteMinorHubScans: true,
};

export class AppStore implements IAppStore {
  readonly storageKind: 'sqlite-local' | 'sqlite-ephemeral';
  private db: SqliteDatabase;

  constructor(dbPath: string = envConfig.dbPath) {
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (location: string) => SqliteDatabase;
    };
    this.storageKind =
      dbPath === ':memory:' || dbPath.startsWith('/tmp') ? 'sqlite-ephemeral' : 'sqlite-local';

    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA busy_timeout = 5000;');
    }
    this.initSchema();
  }

  async init(): Promise<void> {
    // Schema already initialized synchronously in constructor
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private initSchema(): void {
    this.db.exec(`
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
        muted INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_parcels_awb ON parcels(awb);
      CREATE INDEX IF NOT EXISTS idx_parcels_archived ON parcels(archived);

      CREATE TABLE IF NOT EXISTS tracking_events (
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
        is_read INTEGER NOT NULL DEFAULT 0,
        push_sent INTEGER NOT NULL DEFAULT 0,
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
    const row = this.db.prepare('SELECT COUNT(*) as c FROM parcels').get();
    return Number(row?.c ?? 0);
  }

  async listParcels(options?: { includeArchived?: boolean }): Promise<Parcel[]> {
    const includeArchived = options?.includeArchived ?? false;
    const rows = includeArchived
      ? this.db.prepare('SELECT * FROM parcels ORDER BY updated_at DESC').all()
      : this.db.prepare('SELECT * FROM parcels WHERE archived = 0 ORDER BY updated_at DESC').all();

    const result: Parcel[] = [];
    for (const r of rows) {
      const parcel = this.mapParcelRow(r);
      const unreadRow = this.db
        .prepare('SELECT COUNT(*) as c FROM alerts WHERE parcel_id = ? AND is_read = 0')
        .get(parcel.id);
      parcel.unreadAlertsCount = Number(unreadRow?.c ?? 0);
      parcel.events = await this.getEventsForParcel(parcel.id, 3);
      result.push(parcel);
    }
    return result;
  }

  async listActiveParcelsForPolling(): Promise<Parcel[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM parcels
         WHERE archived = 0
           AND status NOT IN ('delivered', 'expired')
           AND provider_used != 'simulator'
         ORDER BY updated_at ASC`
      )
      .all();
    return rows.map((r) => this.mapParcelRow(r));
  }

  async getParcelById(id: string): Promise<Parcel | null> {
    const row = this.db.prepare('SELECT * FROM parcels WHERE id = ?').get(id);
    if (!row) return null;
    const parcel = this.mapParcelRow(row);
    parcel.events = await this.getEventsForParcel(id);
    const unreadRow = this.db
      .prepare('SELECT COUNT(*) as c FROM alerts WHERE parcel_id = ? AND is_read = 0')
      .get(id);
    parcel.unreadAlertsCount = Number(unreadRow?.c ?? 0);
    return parcel;
  }

  async getParcelByAwb(awb: string): Promise<Parcel | null> {
    const row = this.db
      .prepare('SELECT * FROM parcels WHERE UPPER(awb) = UPPER(?) AND archived = 0 LIMIT 1')
      .get(awb);
    return row ? this.mapParcelRow(row) : null;
  }

  async createParcel(parcel: CreateParcelRecord): Promise<Parcel> {
    this.db
      .prepare(
        `INSERT INTO parcels (
          id, awb, carrier_code, carrier_name, item_title, item_category, item_emoji,
          merchant, item_notes, item_image_url, order_url,
          origin_country, origin_flag, destination_country, destination_flag,
          status, status_summary, estimated_delivery, last_location, last_event_at,
          provider_used, provider_tracking_id, simulator_stage, simulator_route_json,
          muted, archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        parcel.muted ? 1 : 0,
        parcel.archived ? 1 : 0,
        parcel.createdAt,
        parcel.updatedAt
      );
    return (await this.getParcelById(parcel.id))!;
  }

  async updateParcel(id: string, patch: UpdateParcelPatch): Promise<Parcel | null> {
    const existing = await this.getParcelById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE parcels SET
          carrier_code = ?, carrier_name = ?,
          item_title = ?, item_category = ?, item_emoji = ?,
          merchant = ?, item_notes = ?, item_image_url = ?, order_url = ?,
          origin_country = ?, origin_flag = ?, destination_country = ?, destination_flag = ?,
          status = ?, status_summary = ?, estimated_delivery = ?, last_location = ?, last_event_at = ?,
          provider_used = ?, provider_tracking_id = ?, simulator_stage = ?, simulator_route_json = ?,
          muted = ?, archived = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
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
        (patch.muted !== undefined ? patch.muted : existing.muted) ? 1 : 0,
        (patch.archived !== undefined ? patch.archived : existing.archived) ? 1 : 0,
        now,
        id
      );

    if (patch.itemTitle && patch.itemTitle !== existing.itemTitle) {
      const existingAlerts = this.db
        .prepare('SELECT id, title, body FROM alerts WHERE parcel_id = ?')
        .all(id);
      for (const a of existingAlerts) {
        const nextTitle = String(a.title).replaceAll(existing.itemTitle, patch.itemTitle);
        const nextBody = String(a.body).replaceAll(existing.itemTitle, patch.itemTitle);
        if (nextTitle !== a.title || nextBody !== a.body) {
          this.db
            .prepare('UPDATE alerts SET title = ?, body = ? WHERE id = ?')
            .run(nextTitle, nextBody, String(a.id));
        }
      }
    }

    return this.getParcelById(id);
  }

  async deleteParcel(id: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM parcels WHERE id = ?').run(id);
    return res.changes > 0;
  }

  async getEventsForParcel(parcelId: string, limit?: number): Promise<TrackingEvent[]> {
    const sql = limit
      ? 'SELECT * FROM tracking_events WHERE parcel_id = ? ORDER BY occurred_at DESC, rowid DESC LIMIT ?'
      : 'SELECT * FROM tracking_events WHERE parcel_id = ? ORDER BY occurred_at DESC, rowid DESC';
    const rows = limit ? this.db.prepare(sql).all(parcelId, limit) : this.db.prepare(sql).all(parcelId);
    return rows.map((r) => this.mapEventRow(r));
  }

  async insertEventIfNew(event: Omit<TrackingEvent, 'id' | 'eventHash' | 'createdAt'>): Promise<{
    inserted: boolean;
    event: TrackingEvent | null;
  }> {
    const dayBucket = event.occurredAt.slice(0, 10);
    const hashInput = `${event.parcelId}|${dayBucket}|${event.rawDescription.toLowerCase().trim()}|${event.location
      .toLowerCase()
      .trim()}|${event.stage}`;
    const eventHash = crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 24);

    const existing = this.db
      .prepare('SELECT * FROM tracking_events WHERE parcel_id = ? AND event_hash = ?')
      .get(event.parcelId, eventHash);

    if (existing) {
      if (new Date(event.occurredAt).getTime() > new Date(String(existing.occurred_at)).getTime()) {
        this.db
          .prepare('UPDATE tracking_events SET occurred_at = ? WHERE id = ?')
          .run(event.occurredAt, String(existing.id));
        existing.occurred_at = event.occurredAt;
      }
      return { inserted: false, event: this.mapEventRow(existing) };
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tracking_events (
          id, parcel_id, event_hash, occurred_at, location, country_code,
          raw_description, friendly_title, friendly_summary, stage, importance, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        createdAt
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
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO alerts (id, parcel_id, event_id, importance, stage, title, body, is_read, push_sent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        input.parcelId,
        input.eventId,
        input.importance,
        input.stage,
        input.title,
        input.body,
        input.pushSent ? 1 : 0,
        createdAt
      );

    return (await this.getAlertById(id))!;
  }

  async getAlertById(id: string): Promise<AlertItem | null> {
    const row = this.db
      .prepare(
        `SELECT a.*, p.item_title as parcel_title, p.item_emoji as parcel_emoji, p.awb as parcel_awb, p.carrier_name
         FROM alerts a
         JOIN parcels p ON p.id = a.parcel_id
         WHERE a.id = ?`
      )
      .get(id);
    return row ? this.mapAlertRow(row) : null;
  }

  async listAlerts(options?: { importantOnly?: boolean; limit?: number }): Promise<AlertItem[]> {
    const limit = options?.limit ?? 80;
    const sql = options?.importantOnly
      ? `SELECT a.*, p.item_title as parcel_title, p.item_emoji as parcel_emoji, p.awb as parcel_awb, p.carrier_name
         FROM alerts a
         JOIN parcels p ON p.id = a.parcel_id
         WHERE a.importance IN ('critical', 'important')
         ORDER BY a.created_at DESC LIMIT ?`
      : `SELECT a.*, p.item_title as parcel_title, p.item_emoji as parcel_emoji, p.awb as parcel_awb, p.carrier_name
         FROM alerts a
         JOIN parcels p ON p.id = a.parcel_id
         ORDER BY a.created_at DESC LIMIT ?`;
    const rows = this.db.prepare(sql).all(limit);
    return rows.map((r) => this.mapAlertRow(r));
  }

  async getUnreadAlertsCount(): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM alerts WHERE is_read = 0').get();
    return Number(row?.c ?? 0);
  }

  async markAlertRead(id: string): Promise<void> {
    this.db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id);
  }

  async markAllAlertsRead(): Promise<void> {
    this.db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0').run();
  }

  async markParcelAlertsRead(parcelId: string): Promise<void> {
    this.db.prepare('UPDATE alerts SET is_read = 1 WHERE parcel_id = ? AND is_read = 0').run(parcelId);
  }

  async savePushToken(token: string, platform = 'unknown', deviceName = ''): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO push_tokens (token, platform, device_name, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET platform = excluded.platform, device_name = excluded.device_name, updated_at = excluded.updated_at`
      )
      .run(token, platform, deviceName, now);
  }

  async listPushTokens(): Promise<string[]> {
    const rows = this.db.prepare('SELECT token FROM push_tokens').all();
    return rows.map((r) => String(r.token));
  }

  private getSettingValue<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key);
    if (!row || typeof row.value_json !== 'string') return fallback;
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return fallback;
    }
  }

  private setSettingValue(key: string, value: unknown): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
      )
      .run(key, JSON.stringify(value));
  }

  async getProviderApiKeys(): Promise<ProviderApiKeys> {
    const saved = this.getSettingValue<ProviderApiKeys>('provider_api_keys', {});
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
    const activeProvider = this.getSettingValue<TrackingProviderId>(
      'active_provider',
      envConfig.defaultProvider
    );
    const pollIntervalMinutes = this.getSettingValue<number>(
      'poll_interval_minutes',
      envConfig.pollIntervalMinutes
    );
    const defaultDestinationCountry = this.getSettingValue<string>(
      'default_destination_country',
      envConfig.defaultDestinationCountry
    );
    const notificationRules = {
      ...DEFAULT_NOTIFICATION_RULES,
      ...this.getSettingValue<Partial<NotificationRules>>('notification_rules', {}),
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
      this.setSettingValue('active_provider', patch.activeProvider);
    }
    if (patch.pollIntervalMinutes !== undefined) {
      this.setSettingValue('poll_interval_minutes', Math.max(5, Math.min(720, patch.pollIntervalMinutes)));
    }
    if (patch.defaultDestinationCountry) {
      this.setSettingValue('default_destination_country', patch.defaultDestinationCountry.trim());
    }
    if (patch.notificationRules) {
      const current = (await this.getSettings()).notificationRules;
      this.setSettingValue('notification_rules', { ...current, ...patch.notificationRules });
    }
    if (patch.apiKeys) {
      const currentKeys = this.getSettingValue<ProviderApiKeys>('provider_api_keys', {});
      const nextKeys: ProviderApiKeys = { ...currentKeys };
      if (patch.apiKeys.whereparcel !== undefined) nextKeys.whereparcel = patch.apiKeys.whereparcel.trim();
      if (patch.apiKeys.dhl !== undefined) nextKeys.dhl = patch.apiKeys.dhl.trim();
      if (patch.apiKeys['17track'] !== undefined) nextKeys['17track'] = patch.apiKeys['17track'].trim();
      if (patch.apiKeys.ship24 !== undefined) nextKeys.ship24 = patch.apiKeys.ship24.trim();
      if (patch.apiKeys.trackingmore !== undefined) nextKeys.trackingmore = patch.apiKeys.trackingmore.trim();
      this.setSettingValue('provider_api_keys', nextKeys);
    }
    return this.getSettings();
  }
}
