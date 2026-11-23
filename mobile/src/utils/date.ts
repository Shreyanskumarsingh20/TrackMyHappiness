export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatEventDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatEtaLabel(etaIso: string | null | undefined, status: string): string | null {
  if (status === 'delivered') return 'Delivered';
  if (status === 'out_for_delivery') return 'Arriving today';
  if (!etaIso) return null;

  const eta = new Date(`${etaIso.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(eta.getTime())) return etaIso;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const etaDay = new Date(eta);
  etaDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round((etaDay.getTime() - today.getTime()) / 86400_000);
  if (diffDays <= 0) return 'Expected today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;

  return `By ${etaDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
