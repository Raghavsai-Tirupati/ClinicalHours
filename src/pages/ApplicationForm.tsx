import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertCircle, Upload, FileText, MapPin, Building2 } from "lucide-react";

interface Opportunity {
  id: string;
  name: string;
  location: string;
  description: string | null;
}

const MAX_ESSAY_WORDS = 500;

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export default function ApplicationForm() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [essay1, setEssay1] = useState("");
  const [essay2, setEssay2] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    async function fetchOpportunity() {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, name, location, description")
        .eq("slug", slug)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setOpportunity(data as Opportunity);
      }
      setLoading(false);
    }
    fetchOpportunity();
  }, [slug]);

  function validate() {
    const errors: Record<string, string> = {};
    if (!studentName.trim()) errors.studentName = "Name is required.";
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    if (!resumeFile) errors.resume = "Resume is required.";
    if (countWords(essay1) > MAX_ESSAY_WORDS)
      errors.essay1 = `Please keep your response under ${MAX_ESSAY_WORDS} words (currently ${countWords(essay1)}).`;
    if (countWords(essay2) > MAX_ESSAY_WORDS)
      errors.essay2 = `Please keep your response under ${MAX_ESSAY_WORDS} words (currently ${countWords(essay2)}).`;
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!opportunity) return;

    setSubmitting(true);
    try {
      // Upload resume to Supabase Storage
      const fileExt = resumeFile!.name.split(".").pop();
      const fileName = `${opportunity.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(fileName, resumeFile!, { upsert: false });

      if (uploadError) {
        if (uploadError.message.includes("row-level security") || uploadError.message.includes("policy")) {
          throw new Error("Resume uploads are not yet enabled. Please contact support.");
        }
        throw new Error(`Resume upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from("resumes").getPublicUrl(fileName);
      const resumeUrl = urlData.publicUrl;

      // Insert application record (include student_id when logged in for GPA lookup)
      const { error: insertError } = await supabase.from("applications").insert({
        opportunity_id: opportunity.id,
        student_name: studentName.trim(),
        student_email: email.trim(),
        student_phone: phone.trim() || null,
        resume_url: resumeUrl,
        student_id: user?.id ?? null,
        essay_responses: {
          question1: essay1.trim(),
          question2: essay2.trim(),
        },
        status: "new",
      });

      if (insertError) {
        // Clean up uploaded file on DB error
        await supabase.storage.from("resumes").remove([fileName]);
        throw new Error(`Submission failed: ${insertError.message}`);
      }

      setSubmitted(true);
      // Reset form
      setStudentName("");
      setEmail("");
      setPhone("");
      setResumeFile(null);
      setEssay1("");
      setEssay2("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">Opportunity Not Found</h1>
        <p className="text-muted-foreground max-w-md">
          The opportunity you're looking for doesn't exist or the link may be incorrect.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full shadow-lg">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Application Submitted!</h2>
          <p className="text-muted-foreground mb-6">
            Your application to <span className="font-semibold text-foreground">{opportunity?.name}</span> has been
            received. You'll hear back via email.
          </p>
          <Button onClick={() => setSubmitted(false)} variant="outline" className="w-full">
            Submit Another Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
            <Building2 className="h-4 w-4" />
            <span>Volunteer Application</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Apply to {opportunity!.name}
          </h1>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-4">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{opportunity!.location}</span>
          </div>
          {opportunity!.description && (
            <p className="text-muted-foreground leading-relaxed border-l-2 border-border pl-4">
              {opportunity!.description}
            </p>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-6 py-4">
            <h2 className="font-semibold text-foreground">Application Form</h2>
            <p className="text-muted-foreground text-sm mt-0.5">All fields marked with * are required</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Personal Information */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Personal Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Jane Smith"
                    className={fieldErrors.studentName ? "border-destructive" : ""}
                  />
                  {fieldErrors.studentName && (
                    <p className="text-destructive text-xs mt-1">{fieldErrors.studentName}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Email Address <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className={fieldErrors.email ? "border-destructive" : ""}
                    />
                    {fieldErrors.email && (
                      <p className="text-destructive text-xs mt-1">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Phone Number <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="border-t border-border" />

            {/* Resume Upload */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Resume
              </h3>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  resumeFile
                    ? "border-green-500/50 bg-green-500/5"
                    : fieldErrors.resume
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setResumeFile(file);
                    if (file) setFieldErrors((prev) => ({ ...prev, resume: "" }));
                  }}
                />
                {resumeFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-6 w-6 text-green-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{resumeFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(resumeFile.size / 1024 / 1024).toFixed(2)} MB — click to change
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground mb-0.5">
                      Upload Resume <span className="text-destructive">*</span>
                    </p>
                    <p className="text-xs text-muted-foreground">PDF or DOCX, up to 10MB</p>
                  </div>
                )}
              </div>
              {fieldErrors.resume && (
                <p className="text-destructive text-xs mt-1">{fieldErrors.resume}</p>
              )}
            </section>

            <div className="border-t border-border" />

            {/* Essay Questions */}
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Essay Questions
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Why do you want to volunteer at this facility?{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">Maximum 500 words</p>
                  <textarea
                    value={essay1}
                    onChange={(e) => setEssay1(e.target.value)}
                    rows={7}
                    placeholder="Share your motivation for volunteering here, what draws you to this specific facility, and how it aligns with your goals..."
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[120px] ${
                      fieldErrors.essay1 ? "border-destructive" : "border-input"
                    }`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {fieldErrors.essay1 ? (
                      <p className="text-destructive text-xs">{fieldErrors.essay1}</p>
                    ) : (
                      <span />
                    )}
                    <span
                      className={`text-xs ${
                        countWords(essay1) > MAX_ESSAY_WORDS
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {countWords(essay1)} / {MAX_ESSAY_WORDS} words
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Describe any relevant healthcare or volunteer experience{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">Maximum 500 words</p>
                  <textarea
                    value={essay2}
                    onChange={(e) => setEssay2(e.target.value)}
                    rows={7}
                    placeholder="Describe previous volunteer roles, healthcare exposure, coursework, or other relevant experiences..."
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[120px] ${
                      fieldErrors.essay2 ? "border-destructive" : "border-input"
                    }`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {fieldErrors.essay2 ? (
                      <p className="text-destructive text-xs">{fieldErrors.essay2}</p>
                    ) : (
                      <span />
                    )}
                    <span
                      className={`text-xs ${
                        countWords(essay2) > MAX_ESSAY_WORDS
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {countWords(essay2)} / {MAX_ESSAY_WORDS} words
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Error Banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-base font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting Application...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 pb-8">
          Your information is securely stored and will only be shared with {opportunity!.name}.
        </p>
      </div>
    </div>
  );
}
