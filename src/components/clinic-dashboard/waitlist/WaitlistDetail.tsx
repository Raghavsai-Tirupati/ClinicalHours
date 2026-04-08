import { useState } from 'react';
import { ArrowLeft, Mail, Pencil, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useWaitlists, useWaitlistSubmissions, type Waitlist } from './hooks';
import WaitlistFormDialog from './WaitlistFormDialog';
import BulkMessageDialog from './BulkMessageDialog';

interface Props {
  waitlist: Waitlist;
  onBack: () => void;
  onUpdated: (w: Waitlist) => void;
}

export default function WaitlistDetail({ waitlist, onBack, onUpdated }: Props) {
  const { hospitalPage } = useHospitalPageContext();
  const clinicId = hospitalPage?.id;
  const { submissions, loading } = useWaitlistSubmissions(clinicId, waitlist.id);
  const { updateWaitlist } = useWaitlists(clinicId);

  const [editOpen, setEditOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);

  const handleEdit = async (input: { title: string; description: string; status?: 'open' | 'closed' }) => {
    const updated = await updateWaitlist(waitlist.id, input);
    onUpdated(updated);
    toast.success('Waitlist updated.');
  };

  const handleExport = () => {
    if (submissions.length === 0) return;
    const headers = ['Name', 'Email', 'Phone', 'University', 'Submitted'];
    const rows = submissions.map((s) => [
      s.full_name,
      s.email,
      s.phone ?? '',
      s.university ?? '',
      new Date(s.submitted_at).toISOString(),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${waitlist.title.replace(/[^a-z0-9]+/gi, '-')}-signups.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to waitlists
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{waitlist.title}</h2>
              <Badge variant={waitlist.status === 'open' ? 'default' : 'secondary'}>
                {waitlist.status === 'open' ? 'Open' : 'Closed'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">{waitlist.description}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={submissions.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button size="sm" onClick={() => setMsgOpen(true)} disabled={submissions.length === 0}>
              <Mail className="h-4 w-4 mr-1" />
              Message Waitlist
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <div className="px-4 py-3 border-b bg-muted/30 text-sm font-medium">
          Signups ({submissions.length})
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No signups yet. Share your public waitlist link to start collecting interest.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">University</th>
                  <th className="px-4 py-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{s.full_name}</td>
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.university ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(s.submitted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <WaitlistFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={waitlist}
        onSubmit={handleEdit}
      />

      <BulkMessageDialog
        open={msgOpen}
        onOpenChange={setMsgOpen}
        waitlist={waitlist}
        recipients={submissions.map((s) => ({ email: s.email, name: s.full_name }))}
      />
    </div>
  );
}
