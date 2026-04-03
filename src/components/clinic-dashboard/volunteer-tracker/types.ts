export type TrackerColumnType = 'number' | 'percentage' | 'rating_1_5' | 'text' | 'boolean';

export interface TrackerCategory {
  id: string;
  clinic_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface TrackerColumn {
  id: string;
  clinic_id: string;
  name: string;
  column_type: TrackerColumnType;
  sort_order: number;
  created_at: string;
}

export interface TrackerEntry {
  id: string;
  clinic_id: string;
  category_id: string;
  volunteer_name: string;
  volunteer_user_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface TrackerValue {
  id: string;
  entry_id: string;
  column_id: string;
  value: string | null;
}

export const COLUMN_TYPE_LABELS: Record<TrackerColumnType, string> = {
  number: 'Number',
  percentage: 'Percentage (0–100%)',
  rating_1_5: 'Rating (1–5)',
  text: 'Text / Notes',
  boolean: 'Checkbox (Yes/No)',
};

export const DEFAULT_CATEGORY_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];
