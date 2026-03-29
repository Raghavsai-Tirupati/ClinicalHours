import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, CheckCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ClinicOnboard() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [clinicName, setClinicName] = useState('');
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch clinic info
  useEffect(() => {
    if (!clinicId) return;
    const fetchClinic = async () => {
      const { data } = await supabase
        .from('hospital_pages')
        .select('id, hospital_id, opportunities:hospital_id (name)')
        .eq('id', clinicId)
        .single();
      if (data) {
        const opp = data.opportunities as unknown as { name: string } | null;
        setClinicName(opp?.name || 'Unknown Clinic');
      }
      setLoadingClinic(false);
    };
    fetchClinic();
  }, [clinicId]);

  // Pre-fill from user profile
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single();
      if (data) {
        setForm((f) => ({
          ...f,
          full_name: data.full_name || f.full_name,
          email: user.email || f.email,
          phone: data.phone || f.phone,
        }));
      } else {
        setForm((f) => ({ ...f, email: user.email || '' }));
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!clinicId) return;

    setSubmitting(true);
    const { error } = await supabase.from('clinic_members').insert({
      clinic_id: clinicId,
      user_id: user?.id || null,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      onboarding_source: 'existing_staff',
      status: 'active',
    });
    setSubmitting(false);

    if (error) {
      toast.error('Failed to register: ' + error.message);
    } else {
      setSubmitted(true);
    }
  };

  if (loadingClinic || authLoading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center pt-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center pt-20 pb-12 px-4">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-6 space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold">You're Registered!</h2>
              <p className="text-muted-foreground text-sm">
                You've been added to <strong>{clinicName}</strong> as existing staff.
                Your clinic admin will complete your onboarding checklist.
              </p>
              <Button asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Join {clinicName} | ClinicalHours</title>
      </Helmet>
      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{clinicName}</span>
              </div>
              <CardTitle>Staff Registration</CardTitle>
              <CardDescription>
                Register as existing staff or volunteer at this clinic
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    type="email"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Register
                </Button>
                {!user && (
                  <p className="text-xs text-muted-foreground text-center">
                    Have a ClinicalHours account?{' '}
                    <Link to={`/auth?redirect=/clinic-onboard/${clinicId}`} className="text-primary underline">
                      Sign in first
                    </Link>
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
