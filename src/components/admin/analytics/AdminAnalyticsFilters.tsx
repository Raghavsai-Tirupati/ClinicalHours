import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIME_RANGE_OPTIONS, type AdminTimeRange } from '@/lib/admin/timeRanges';
import type { ClinicOption } from '@/lib/admin/analytics';

interface AdminAnalyticsFiltersProps {
  timeRange: AdminTimeRange;
  onTimeRangeChange: (range: AdminTimeRange) => void;
  clinicId: string | null;
  onClinicChange: (id: string | null) => void;
  clinics: ClinicOption[];
}

export default function AdminAnalyticsFilters({
  timeRange,
  onTimeRangeChange,
  clinicId,
  onClinicChange,
  clinics,
}: AdminAnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as AdminTimeRange)}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="Time range" />
        </SelectTrigger>
        <SelectContent>
          {TIME_RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={clinicId ?? 'all'}
        onValueChange={(v) => onClinicChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="All clinics" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            All clinics
          </SelectItem>
          {clinics.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
