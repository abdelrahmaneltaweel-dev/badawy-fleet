/**
 * Badawi Fleet Platform - Six Dashboard Cards Registry & Resolver
 * Ref: ADR-059, Decision D-059 (Six Dashboard Cards Order & Visibility)
 * Ref: T6.1 (بطاقات الداشبورد الست: إظهار وترتيب من الإعدادات)
 */

export type DashboardCardId =
  | 'fleet_status'
  | 'gps_issues'
  | 'inquiries_pending'
  | 'tractor_hauls'
  | 'truck_trips'
  | 'petro_wallet';

export interface DashboardCardMeta {
  id: DashboardCardId;
  title: string;
  subtitle: string;
  icon: string;
  defaultVisible: boolean;
  defaultOrder: number;
  settingKey: string;
}

export const CANONICAL_DASHBOARD_CARDS_ORDER: DashboardCardId[] = [
  'fleet_status',
  'gps_issues',
  'inquiries_pending',
  'tractor_hauls',
  'truck_trips',
  'petro_wallet'
];

export const DASHBOARD_CARDS_CATALOG: Record<DashboardCardId, DashboardCardMeta> = {
  fleet_status: {
    id: 'fleet_status',
    title: 'حالة الأسطول الآن',
    subtitle: 'Online / Offline / واقفة مقسّمة جرار ونقل وملاكي',
    icon: '🚛',
    defaultVisible: true,
    defaultOrder: 1,
    settingKey: 'dashboard_show_fleet_status'
  },
  gps_issues: {
    id: 'gps_issues',
    title: 'مشاكل GPS المفتوحة',
    subtitle: 'مدة الانقطاع وأزرار اتصال وواتساب للسائق',
    icon: '⚠️',
    defaultVisible: true,
    defaultOrder: 2,
    settingKey: 'dashboard_show_gps_issues'
  },
  inquiries_pending: {
    id: 'inquiries_pending',
    title: 'استفسارات منتظرة رد',
    subtitle: 'سائقين، مدير الخلاطة، وأمن الجراج',
    icon: '⏳',
    defaultVisible: true,
    defaultOrder: 3,
    settingKey: 'dashboard_show_inquiries'
  },
  tractor_hauls: {
    id: 'tractor_hauls',
    title: 'نقلات أمس للجرارات الـ 10',
    subtitle: 'المطابقة الثلاثية (GPS ↔ خلاطة ↔ جراج) والفروق',
    icon: '🏗️',
    defaultVisible: true,
    defaultOrder: 4,
    settingKey: 'dashboard_show_tractor_hauls'
  },
  truck_trips: {
    id: 'truck_trips',
    title: 'مشاوير عربيات النقل والملاكي',
    subtitle: 'إجمالي المشاوير والوقفات والزيارات التشغيلية',
    icon: '🚗',
    defaultVisible: true,
    defaultOrder: 5,
    settingKey: 'dashboard_show_truck_trips'
  },
  petro_wallet: {
    id: 'petro_wallet',
    title: 'محفظة Petro وطلب العهدة',
    subtitle: 'الرصيد المتبقي وتنبيه إعادة الطلب عند 25,000 ج.م',
    icon: '⛽',
    defaultVisible: true,
    defaultOrder: 6,
    settingKey: 'dashboard_show_wallet_card'
  }
};

/**
 * Resolves ordered, visible cards given current settings values.
 */
export function resolveDashboardCards(
  settingsValues: Record<string, unknown> = {}
): DashboardCardMeta[] {
  // 1. Determine card order
  const rawOrderStr = typeof settingsValues['dashboard_cards_order'] === 'string'
    ? (settingsValues['dashboard_cards_order'] as string)
    : '';

  const parsedIds = rawOrderStr
    .split(',')
    .map((s) => s.trim())
    .filter((id): id is DashboardCardId => id in DASHBOARD_CARDS_CATALOG);

  // Fill in any missing cards from canonical order
  const finalOrder: DashboardCardId[] = [...parsedIds];
  for (const canonicalId of CANONICAL_DASHBOARD_CARDS_ORDER) {
    if (!finalOrder.includes(canonicalId)) {
      finalOrder.push(canonicalId);
    }
  }

  // 2. Filter by visibility setting
  const visibleCards: DashboardCardMeta[] = [];
  for (const cardId of finalOrder) {
    const meta = DASHBOARD_CARDS_CATALOG[cardId];
    if (!meta) continue;

    const isVisible = settingsValues[meta.settingKey] !== undefined
      ? Boolean(settingsValues[meta.settingKey])
      : meta.defaultVisible;

    if (isVisible) {
      visibleCards.push(meta);
    }
  }

  return visibleCards;
}

/**
 * Reorders cards and returns the comma-separated order string.
 */
export function moveDashboardCard(
  orderStr: string,
  cardId: DashboardCardId,
  direction: 'up' | 'down'
): string {
  const currentList = orderStr
    ? orderStr.split(',').map((s) => s.trim()).filter((id): id is DashboardCardId => id in DASHBOARD_CARDS_CATALOG)
    : [...CANONICAL_DASHBOARD_CARDS_ORDER];

  // Ensure all canonical cards exist
  for (const c of CANONICAL_DASHBOARD_CARDS_ORDER) {
    if (!currentList.includes(c)) currentList.push(c);
  }

  const idx = currentList.indexOf(cardId);
  if (idx === -1) return currentList.join(',');

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= currentList.length) {
    return currentList.join(',');
  }

  // Swap
  const temp = currentList[idx];
  currentList[idx] = currentList[targetIdx];
  currentList[targetIdx] = temp;

  return currentList.join(',');
}
