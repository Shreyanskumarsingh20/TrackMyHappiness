import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getBackendUrl, setBackendUrl as persistBackendUrl } from '../services/api';
import {
  fireLocalMilestoneNotification,
  registerForPushNotificationsAsync,
} from '../services/notifications';
import { AlertItem, AppSettings, ItemCategory, NotificationRules, Parcel, TrackingProviderId } from '../types';

export interface ToastNotice {
  id: string;
  title: string;
  body: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

interface ParcelsContextValue {
  parcels: Parcel[];
  alerts: AlertItem[];
  unreadCount: number;
  settings: AppSettings | null;
  backendUrl: string;
  loading: boolean;
  refreshing: boolean;
  connectionError: string | null;
  storageKind: string | null;
  toast: ToastNotice | null;
  dismissToast: () => void;
  showToast: (notice: Omit<ToastNotice, 'id'>) => void;
  refreshData: (silent?: boolean) => Promise<void>;
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
  }) => Promise<Parcel>;
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
  ) => Promise<Parcel>;
  refreshParcel: (id: string) => Promise<{ parcel: Parcel; alerts: AlertItem[] }>;
  deleteParcel: (id: string) => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
  markAllAlertsRead: () => Promise<void>;
  markParcelAlertsRead: (parcelId: string) => Promise<void>;
  updateSettings: (patch: {
    activeProvider?: TrackingProviderId;
    pollIntervalMinutes?: number;
    defaultDestinationCountry?: string;
    notificationRules?: Partial<NotificationRules>;
    apiKeys?: Partial<Record<'whereparcel' | 'dhl' | '17track' | 'ship24' | 'trackingmore', string>>;
  }) => Promise<AppSettings>;
  updateBackendUrl: (nextUrl: string) => Promise<boolean>;
}

const ParcelsContext = createContext<ParcelsContextValue | null>(null);

export function ParcelsProvider({ children }: { children: React.ReactNode }) {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [backendUrl, setBackendUrlState] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [storageKind, setStorageKind] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);

  const showToast = useCallback((notice: Omit<ToastNotice, 'id'>) => {
    const id = String(Date.now());
    setToast({ id, ...notice });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const refreshData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [parcelsRes, alertsRes, settingsRes, healthRes] = await Promise.all([
        api.listParcels(false),
        api.listAlerts(false),
        api.getSettings(),
        api.health().catch(() => null),
      ]);
      setParcels(parcelsRes.parcels);
      setAlerts(alertsRes.alerts);
      setUnreadCount(alertsRes.unreadCount);
      setSettings(settingsRes.settings);
      if (healthRes?.storage) setStorageKind(healthRes.storage);
      setConnectionError(null);
    } catch (err: any) {
      setConnectionError(err?.message || 'Unable to connect to tracking server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await getBackendUrl();
      if (mounted) setBackendUrlState(url);
      await refreshData(false);
      registerForPushNotificationsAsync().catch(() => {});
    })();

    // Gentle auto-sync every 45s while app is open
    const timer = setInterval(() => {
      refreshData(true);
    }, 45_000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refreshData]);

  const createParcel = useCallback(
    async (payload: Parameters<ParcelsContextValue['createParcel']>[0]) => {
      const res = await api.createParcel(payload);
      // Immediately populate local state so /parcel/[id] renders with zero blank frame
      setParcels((prev) => [res.parcel, ...prev.filter((p) => p.id !== res.parcel.id)]);
      if (res.alerts.length > 0) {
        setAlerts((prev) => [...res.alerts, ...prev]);
        setUnreadCount((prev) => prev + res.alerts.length);
      }
      refreshData(true).catch(() => {});
      if (res.alerts[0]) {
        showToast({
          title: res.alerts[0].title,
          body: res.alerts[0].body,
          tone: 'success',
        });
      } else {
        showToast({
          title: `Tracking started: ${res.parcel.itemEmoji} ${res.parcel.itemTitle}`,
          body: `Watching ${res.parcel.carrierName} (${res.parcel.awb}) for important updates.`,
          tone: 'success',
        });
      }
      return res.parcel;
    },
    [refreshData, showToast]
  );

  const updateParcel = useCallback(
    async (id: string, patch: Parameters<ParcelsContextValue['updateParcel']>[1]) => {
      const res = await api.updateParcel(id, patch);
      setParcels((prev) => prev.map((p) => (p.id === id ? res.parcel : p)));
      return res.parcel;
    },
    []
  );

  const refreshParcel = useCallback(
    async (id: string) => {
      const res = await api.refreshParcel(id);
      await refreshData(true);

      if (res.alerts.length > 0) {
        const latestAlert = res.alerts[res.alerts.length - 1];
        const tone =
          latestAlert.importance === 'critical'
            ? 'danger'
            : latestAlert.stage === 'delivered'
            ? 'success'
            : latestAlert.stage === 'out_for_delivery' || latestAlert.stage === 'customs'
            ? 'warning'
            : 'info';

        showToast({
          title: latestAlert.title,
          body: latestAlert.body,
          tone,
        });
        fireLocalMilestoneNotification(latestAlert.title, latestAlert.body).catch(() => {});
      } else if (res.newEvents.length > 0) {
        showToast({
          title: 'Routine hub scan logged',
          body: 'Minor transit scan added quietly (important-only notifications active).',
          tone: 'info',
        });
      } else {
        showToast({
          title: 'All caught up',
          body: 'No new carrier scans yet.',
          tone: 'info',
        });
      }

      return { parcel: res.parcel, alerts: res.alerts };
    },
    [refreshData, showToast]
  );

  const deleteParcel = useCallback(
    async (id: string) => {
      await api.deleteParcel(id);
      setParcels((prev) => prev.filter((p) => p.id !== id));
      await refreshData(true);
    },
    [refreshData]
  );

  const markAlertRead = useCallback(async (id: string) => {
    const res = await api.markAlertRead(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    setUnreadCount(res.unreadCount);
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    await api.markAllAlertsRead();
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);
  }, []);

  const markParcelAlertsRead = useCallback(async (parcelId: string) => {
    const res = await api.markParcelRead(parcelId);
    setAlerts((prev) => prev.map((a) => (a.parcelId === parcelId ? { ...a, isRead: true } : a)));
    setUnreadCount(res.unreadAlertsCount);
  }, []);

  const updateSettings = useCallback(
    async (patch: {
      activeProvider?: TrackingProviderId;
      pollIntervalMinutes?: number;
      defaultDestinationCountry?: string;
      notificationRules?: Partial<NotificationRules>;
      apiKeys?: Partial<Record<'whereparcel' | 'dhl' | '17track' | 'ship24' | 'trackingmore', string>>;
    }) => {
      const res = await api.updateSettings(patch);
      setSettings(res.settings);
      return res.settings;
    },
    []
  );

  const updateBackendUrl = useCallback(
    async (nextUrl: string) => {
      const cleaned = await persistBackendUrl(nextUrl);
      setBackendUrlState(cleaned);
      try {
        await api.health();
        await refreshData(false);
        showToast({
          title: 'Connected to backend!',
          body: cleaned,
          tone: 'success',
        });
        return true;
      } catch (err: any) {
        setConnectionError(err?.message || `Could not connect to ${cleaned}`);
        return false;
      }
    },
    [refreshData, showToast]
  );

  return (
    <ParcelsContext.Provider
      value={{
        parcels,
        alerts,
        unreadCount,
        settings,
        backendUrl,
        loading,
        refreshing,
        connectionError,
        storageKind,
        toast,
        dismissToast,
        showToast,
        refreshData,
        createParcel,
        updateParcel,
        refreshParcel,
        deleteParcel,
        markAlertRead,
        markAllAlertsRead,
        markParcelAlertsRead,
        updateSettings,
        updateBackendUrl,
      }}
    >
      {children}
    </ParcelsContext.Provider>
  );
}

export function useParcels(): ParcelsContextValue {
  const ctx = useContext(ParcelsContext);
  if (!ctx) throw new Error('useParcels must be used inside ParcelsProvider');
  return ctx;
}
