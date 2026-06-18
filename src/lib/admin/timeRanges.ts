export type AdminTimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

export type ChartGranularity = 'day' | 'week' | 'month';

export interface DateRange {
  since: Date;
  until: Date;
  label: string;
  granularity: ChartGranularity;
}

export function resolveAdminDateRange(range: AdminTimeRange): DateRange {
  const until = new Date();
  const since = new Date(until);

  switch (range) {
    case '7d':
      since.setDate(since.getDate() - 7);
      return { since, until, label: 'Last 7 days', granularity: 'day' };
    case '30d':
      since.setDate(since.getDate() - 30);
      return { since, until, label: 'Last 30 days', granularity: 'day' };
    case '90d':
      since.setDate(since.getDate() - 90);
      return { since, until, label: 'Last 90 days', granularity: 'week' };
    case 'ytd':
      since.setMonth(0, 1);
      since.setHours(0, 0, 0, 0);
      return { since, until, label: 'Year to date', granularity: 'week' };
    case 'all':
      since.setFullYear(2024, 0, 1);
      return { since, until, label: 'All time', granularity: 'month' };
  }
}

export const TIME_RANGE_OPTIONS: { value: AdminTimeRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];
