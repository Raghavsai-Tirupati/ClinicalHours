import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportToCsv } from '@/lib/analytics/exportCsv';

interface ExportButtonProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: { key: keyof T; label: string }[];
  filename: string;
  disabled?: boolean;
  label?: string;
}

export default function ExportButton<T extends Record<string, unknown>>({
  rows,
  columns,
  filename,
  disabled,
  label = 'Export CSV',
}: ExportButtonProps<T>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5"
      disabled={disabled || rows.length === 0}
      onClick={() => exportToCsv(rows, columns, filename)}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
