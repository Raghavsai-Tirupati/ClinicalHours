import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, CheckCircle, ArrowLeft, MapPin, Clock, Building2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePositionDetail } from '@/hooks/usePositionDetail';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { POSITION_TYPE_LABELS } from '@/types/positions';

export default function PositionApplyPage() {
  const { positionId } = useParams<{ positionId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isComplete: isProfileComplete, isLoading: profileLoading, missingFields } = useProfileComplete();
  const { position, questions, loading, error } = usePositionDetail(positionId);

  const [profile, setProfile] = useState<{
    full_name: string;
    email: string;
    university: string;
    major: string;
    phone: string;
  } | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fileAnswers, setFileAnswers] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch profile
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, university, major, phone')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          email: user.email || '',
          university: data.university || '',
          major: data.major || '',
          phone: data.phone || '',
        });
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch hospital name via position's hospital_page
  useEffect(() => {
    if (!position) return;
    const fetchHospitalName = async () => {
      const { data } = await supabase
        .from('hospital_pages')
        .select('hospital_id, opportunities:hospital_id (name)')
        .eq('id', position.hospital_page_id)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = (data as any)?.opportunities;
      if (opp?.name) setHospitalName(opp.name);
    };
    fetchHospitalName();
  }, [position]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !positionId) return;
    setSubmitError(null);

    if (profileLoading) {
      setSubmitError('Checking your profile requirements. Please wait a moment and try again.');
      return;
    }

    if (!isProfileComplete) {
      setSubmitError('Please complete all required profile fields before submitting this application.');
      return;
    }

    // Validate required questions
    for (const q of questions) {
      if (q.question_type === 'file_upload') {
        if (q.is_required && !fileAnswers[q.id]) {
          toast.error(`Please upload: "${q.question_text}"`);
          return;
        }
        continue;
      }

      if (q.is_required && !answers[q.id]?.trim()) {
        toast.error(`Please answer: "${q.question_text}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const uploadedFiles: Record<string, { fileName: string; publicUrl: string }> = {};

      for (const q of questions) {
        if (q.question_type !== 'file_upload') continue;
        const file = fileAnswers[q.id];
        if (!file) continue;

        const extension = file.name.split('.').pop() || 'dat';
        const storageFileName = `position-applications/${user.id}/${positionId}/${Date.now()}-${q.id}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(storageFileName, file, { upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message || `Failed to upload ${file.name}`);
        }

        const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(storageFileName);
        uploadedFiles[q.id] = {
          fileName: file.name,
          publicUrl: publicUrlData.publicUrl,
        };
      }

      const payloadAnswers = questions
        .map((q) => {
          if (q.question_type === 'file_upload') {
            const uploaded = uploadedFiles[q.id];
            if (!uploaded) return null;
            return {
              question_id: q.id,
              answer_text: uploaded.fileName,
              answer_file_url: uploaded.publicUrl,
            };
          }

          const value = answers[q.id]?.trim();
          if (!value) return null;
          return {
            question_id: q.id,
            answer_text: value,
          };
        })
        .filter(Boolean);

      const { data, error } = await supabase.functions.invoke('submit-position-application', {
        body: {
          position_id: positionId,
          answers: payloadAnswers,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to submit application');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSubmitted(true);
    } catch (err) {
      if (err && typeof err === 'object' && 'message' in err) {
        toast.error(String((err as { message: unknown }).message));
      } else {
        toast.error('Failed to submit application');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center pt-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center pt-20">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>You need to be logged in to apply</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to={`/auth?redirect=/apply/${positionId}`}>Sign In</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  if (error || !position) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center pt-20">
          <p className="text-muted-foreground">{error || 'Position not found'}</p>
        </div>
        <Footer />
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
              <h2 className="text-xl font-bold">Application Submitted!</h2>
              <p className="text-muted-foreground text-sm">
                Your application to <strong>{hospitalName}</strong> for <strong>{position.title}</strong> has been submitted successfully.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" asChild>
                  <Link to="/my-applications">My Applications</Link>
                </Button>
                <Button asChild>
                  <Link to="/opportunities">Browse More</Link>
                </Button>
              </div>
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
        <title>Apply: {position.title} | ClinicalHours</title>
      </Helmet>
      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {/* Position info */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{hospitalName}</span>
              </div>
              <CardTitle>{position.title}</CardTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {POSITION_TYPE_LABELS[position.position_type]}
                </Badge>
                {position.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {position.location}
                  </span>
                )}
                {position.hours_per_week && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {position.hours_per_week} hrs/wk
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile info (pre-filled) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Information</CardTitle>
                <CardDescription>Pre-filled from your profile</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{profile?.full_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">University</p>
                  <p className="font-medium">{profile?.university || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Major</p>
                  <p className="font-medium">{profile?.major || '—'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Custom questions */}
            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questions.map((q) => (
                    <div key={q.id} className="space-y-2">
                      <Label>
                        {q.question_text}
                        {q.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>

                      {q.question_type === 'short_answer' && (
                        <Input
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          required={q.is_required}
                        />
                      )}

                      {q.question_type === 'long_answer' && (
                        <Textarea
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          rows={4}
                          required={q.is_required}
                        />
                      )}

                      {q.question_type === 'yes_no' && (
                        <RadioGroup
                          value={answers[q.id] || ''}
                          onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="Yes" id={`${q.id}-yes`} />
                              <Label htmlFor={`${q.id}-yes`}>Yes</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="No" id={`${q.id}-no`} />
                              <Label htmlFor={`${q.id}-no`}>No</Label>
                            </div>
                          </div>
                        </RadioGroup>
                      )}

                      {q.question_type === 'multiple_choice' && q.options && (
                        <RadioGroup
                          value={answers[q.id] || ''}
                          onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                        >
                          <div className="space-y-2">
                            {(q.options as string[]).map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
                                <Label htmlFor={`${q.id}-${i}`}>{opt}</Label>
                              </div>
                            ))}
                          </div>
                        </RadioGroup>
                      )}

                      {q.question_type === 'file_upload' && (
                        <Input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setFileAnswers((prev) => ({ ...prev, [q.id]: file }));
                            }
                          }}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {!profileLoading && !isProfileComplete && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-medium text-amber-300">
                  Complete your profile before applying
                </p>
                <p className="text-xs text-amber-200/90 mt-1">
                  Required fields: {missingFields.join(', ')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate('/settings')}
                >
                  Go to Settings
                </Button>
              </div>
            )}

            {submitError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{submitError}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11"
              disabled={submitting || profileLoading || !isProfileComplete}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
}
