import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  AlertItem,
  AppSettings,
  CarrierDetectionResult,
  CarrierOption,
  ItemCategory,
  NotificationRules,
  Parcel,
  SmartPasteResult,
  TrackingEvent,
  TrackingProviderId,
} from '../types';

const BACKEND_URL_KEY = 'tmh_backend_url_v1';

export function getDefaultBackendUrl(): string {
  // 1. Explicit production backend URL baked into the EAS APK or web build
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. When served as a unified web app from the production backend server itself,
  // talk directly to the same origin (zero CORS or manual IP config needed!)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const port = window.location.port;
    if (port !== '8081' && port !== '19006' && window.location.protocol.startsWith('http')) {
      return window.location.origin;
    }
  }

  // 3. When running on a physical phone via Expo Go, Constants.expoConfig?.hostUri
  // holds the dev machine's LAN IP (e.g. "192.168.1.15:8081") — auto-use port 4000!
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (Platform.OS !== 'web' && typeof hostUri === 'string' && hostUri.includes(':')) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

let cachedBaseUrl: string | null = null;

export async function getBackendUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const saved = await AsyncStorage.getItem(BACKEND_URL_KEY);
    if (saved && saved.trim().length > 0) {
      cachedBaseUrl = saved.trim().replace(/\/+$/, '');
      return cachedBaseUrl;
    }
  } catch {
    // ignore storage errors
  }
  cachedBaseUrl = getDefaultBackendUrl();
  return cachedBaseUrl;
}

export async function setBackendUrl(url: string): Promise<string> {
  const cleaned = url.trim().replace(/\/+$/, '') || getDefaultBackendUrl();
  cachedBaseUrl = cleaned;
  try {
    await AsyncStorage.setItem(BACKEND_URL_KEY, cleaned);
  } catch {
    // ignore
  }
  return cleaned;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = await getBackendUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Could not reach backend at ${baseUrl} (timeout)`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () =>
    request<{
      ok: boolean;
      service: string;
      activeProvider: TrackingProviderId;
      parcelsCount: number;
      unreadAlertsCount: number;
    }>('/api/health'),

  listParcels: (includeArchived = false) =>
    request<{ parcels: Parcel[]; unreadAlertsCount: number }>(
      `/api/parcels${includeArchived ? '?includeArchived=true' : ''}`
    ),

  getParcel: (id: string) => request<{ parcel: Parcel }>(`/api/parcels/${id}`),

  createParcel: (payload: {
    awb: string;
    itemTitle: string;
    carrierCode?: string;
    itemCategory?: ItemCategory;
    itemEmoji?: string;
    merchant?: string;
    itemNotes?: string;
    itemImageUrl?: string;
    orderUrl?: string;
    originCountry?: string;
    destinationCountry?: string;
    estimatedDelivery?: string | null;
    hintText?: string;
  }) =>
    request<{ parcel: Parcel; alerts: AlertItem[] }>('/api/parcels', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateParcel: (
    id: string,
    patch: Partial<{
      itemTitle: string;
      itemCategory: ItemCategory;
      itemEmoji: string;
      merchant: string;
      itemNotes: string;
      itemImageUrl: string;
      orderUrl: string;
      estimatedDelivery: string | null;
      muted: boolean;
      archived: boolean;
    }>
  ) =>
    request<{ parcel: Parcel }>(`/api/parcels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  refreshParcel: (id: string) =>
    request<{ parcel: Parcel; newEvents: TrackingEvent[]; alerts: AlertItem[] }>(
      `/api/parcels/${id}/refresh`,
      { method: 'POST' }
    ),

  markParcelRead: (id: string) =>
    request<{ ok: boolean; unreadAlertsCount: number }>(`/api/parcels/${id}/mark-read`, {
      method: 'POST',
    }),

  deleteParcel: (id: string) =>
    request<{ deleted: boolean }>(`/api/parcels/${id}`, { method: 'DELETE' }),

  listAlerts: (importantOnly = false) =>
    request<{ alerts: AlertItem[]; unreadCount: number }>(
      `/api/alerts${importantOnly ? '?importantOnly=true' : ''}`
    ),

  markAlertRead: (id: string) =>
    request<{ ok: boolean; unreadCount: number }>(`/api/alerts/${id}/read`, { method: 'POST' }),

  markAllAlertsRead: () =>
    request<{ ok: boolean; unreadCount: number }>('/api/alerts/read-all', { method: 'POST' }),

  registerPushToken: (token: string, platform: string, deviceName: string) =>
    request<{ registered: boolean }>('/api/alerts/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform, deviceName }),
    }),

  smartPaste: (text: string) =>
    request<SmartPasteResult>('/api/tools/smart-paste', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  detectCarrier: (awb: string, hintText?: string) =>
    request<CarrierDetectionResult>('/api/tools/detect-carrier', {
      method: 'POST',
      body: JSON.stringify({ awb, hintText }),
    }),

  listCarriers: () => request<{ carriers: CarrierOption[] }>('/api/tools/carriers'),

  getSettings: () => request<{ settings: AppSettings }>('/api/settings'),

  updateSettings: (patch: {
    activeProvider?: TrackingProviderId;
    pollIntervalMinutes?: number;
    defaultDestinationCountry?: string;
    notificationRules?: Partial<NotificationRules>;
    apiKeys?: Partial<Record<'whereparcel' | 'dhl' | '17track' | 'ship24' | 'trackingmore', string>>;
  }) =>
    request<{ settings: AppSettings }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};
