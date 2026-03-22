import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function HospitalSettings() {
  const { hospitalPage, refetch } = useHospitalPageContext();
  const { toast } = useToast();
  const location = useLocation();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  if (!hospitalPage) return null;

  const handleConnectGmail = async () => {
    setConnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('gmail-oauth-initiate', {
        body: { hospitalPageId: hospitalPage.id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || !data?.success) {
        toast({ title: 'Failed to start Gmail connection', description: data?.error || error?.message, variant: 'destructive' });
        return;
      }

      sessionStorage.setItem('gmail_oauth_return_path', location.pathname);
      window.location.href = data.url;
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setDisconnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast({ title: 'Not authenticated', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('gmail-disconnect', {
        body: { hospitalPageId: hospitalPage.id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || !data?.success) {
        toast({ title: 'Failed to disconnect Gmail', description: data?.error || error?.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Gmail disconnected' });
      refetch();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  const connectedDate = hospitalPage.gmail_connected_at
    ? new Date(hospitalPage.gmail_connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Hospital Information</CardTitle>
          <CardDescription>Details pulled from your listing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{hospitalPage.opportunity.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{hospitalPage.opportunity.location}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <Badge variant="outline">{hospitalPage.opportunity.type}</Badge>
            </div>
            {hospitalPage.opportunity.website && (
              <div>
                <p className="text-muted-foreground">Website</p>
                <a
                  href={hospitalPage.opportunity.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  {hospitalPage.opportunity.website}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Admin Email</p>
            <p className="font-medium">{hospitalPage.admin_email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <Badge variant={hospitalPage.is_claimed ? 'default' : 'outline'}>
              {hospitalPage.is_claimed ? 'Claimed' : 'Unclaimed'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gmail Integration</CardTitle>
          <CardDescription>
            Connect your Gmail account to send applicant emails directly from your own address. If not connected, emails are sent via ClinicalHours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hospitalPage.gmail_email ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GoogleLogo className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{hospitalPage.gmail_email}</p>
                  {connectedDate && (
                    <p className="text-xs text-muted-foreground">Connected {connectedDate}</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectGmail}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">No Gmail account connected.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnectGmail}
                disabled={connecting}
                className="gap-2"
              >
                <GoogleLogo className="h-4 w-4" />
                {connecting ? 'Connecting…' : 'Connect Gmail'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
