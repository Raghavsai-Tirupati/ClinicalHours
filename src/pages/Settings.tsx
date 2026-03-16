import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalAccount } from "@/hooks/useHospitalAccount";
import { useHospitalMember } from "@/hooks/useHospitalMember";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { supabase } from "@/integrations/supabase/client";
import CinematicLayout from "@/components/layout/CinematicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserProfileBadge } from "@/components/UserProfileBadge";
import { REQUIRED_FIELDS } from "@/hooks/useProfileComplete";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Upload,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Mail,
  Cloud,
  CloudOff,
  Check,
  LogOut,
  Bell,
  Building2,
  Globe,
  Phone,
  MapPin,
  ChevronDown,
  User,
  Settings as SettingsIcon,
  CreditCard,
  Trash2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { logProfileUpdate, logFileAccess } from "@/lib/auditLogger";
import {
  validatePhoneNumber,
  validateGPA,
  validateGraduationYear,
  validateLinkedInURL,
  sanitizeProfileData,
} from "@/lib/inputValidation";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useAutoSaveProfile } from "@/hooks/useAutoSaveProfile";
import { DatalistInput } from "@/components/DatalistInput";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { US_STATES } from "@/lib/data/usStates";
import { COMMON_MAJORS } from "@/lib/data/majors";
import { COMMON_UNIVERSITIES } from "@/lib/data/universities";
import { getGraduationYears } from "@/lib/data/graduationYears";

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isReady, signOut, isGuest } = useAuth();
  const { isHospital, hospitalAccount, isLoading: hospitalLoading } = useHospitalAccount();
  const { member: hospitalMember, loading: memberLoading } = useHospitalMember();
  const { isPremium, premiumExpiresAt } = usePremiumStatus();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumeSignedUrl, setResumeSignedUrl] = useState<string | null>(null);

  // Collapsible section state
  const [profileOpen, setProfileOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);

  // Delete account modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Cancel subscription modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    city: "",
    state: "",
    phone: "",
    university: "",
    major: "",
    gpa: "",
    graduation_year: "",
    clinical_hours: "",
    pre_med_track: "",
    bio: "",
    career_goals: "",
    research_experience: "",
    linkedin_url: "",
    resume_url: "",
    email_opt_in: false,
  });

  const getCompletenessInfo = () => {
    const requiredFieldKeys = REQUIRED_FIELDS.map((f) => f.key);
    const filledCount = requiredFieldKeys.filter((key) => {
      const value = profile[key as keyof typeof profile];
      return value && String(value).trim() !== "";
    }).length;

    const percentage = (filledCount / requiredFieldKeys.length) * 100;
    const missingFields = REQUIRED_FIELDS.filter((f) => {
      const value = profile[f.key as keyof typeof profile];
      return !value || String(value).trim() === "";
    });

    return { percentage, filledCount, total: requiredFieldKeys.length, missingFields };
  };

  const completeness = getCompletenessInfo();
  const isProfileComplete = completeness.percentage === 100;

  const { loadSavedData, clearSavedData } = useAutoSave(profile, "profile-form-draft", true);
  const { status: autoSaveStatus, saveNow, markAsSaved } = useAutoSaveProfile(profile, {
    userId: user?.id,
    enabled: !!user?.id,
    debounceMs: 2000,
  });

  const graduationYears = useMemo(() => getGraduationYears(), []);

  const getSignedResumeUrl = useCallback(async (path: string) => {
    if (!path) return null;
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrl(path, 900);
      if (error) throw error;
      logFileAccess("resume", path);
      return data?.signedUrl || null;
    } catch (error) {
      logger.error("Error getting signed URL", error);
      return null;
    }
  }, []);

  const handleResumeView = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!resumeSignedUrl || !profile.resume_url) return;

      try {
        const response = await fetch(resumeSignedUrl);
        if (!response.ok) throw new Error("Failed to load resume");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `resume_${profile.full_name || "resume"}.${profile.resume_url.split(".").pop() || "pdf"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        logger.error("Error viewing resume", error);
        toast.error("Unable to open resume. Please try again.");
      }
    },
    [resumeSignedUrl, profile.resume_url, profile.full_name]
  );

  useEffect(() => {
    if (!isReady) return;

    if (!user || isGuest) {
      navigate("/auth");
    } else {
      loadProfile();
      const savedDraft = loadSavedData();
      if (savedDraft && Object.keys(savedDraft).length > 0) {
        if (!profile.full_name && !profile.university) {
          setProfile(savedDraft);
        }
      }
    }
  }, [user, isReady, isGuest, navigate]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || "",
          city: data.city || "",
          state: data.state || "",
          phone: data.phone || "",
          university: data.university || "",
          major: data.major || "",
          gpa: data.gpa?.toString() || "",
          graduation_year: data.graduation_year?.toString() || "",
          clinical_hours: data.clinical_hours?.toString() || "",
          pre_med_track: data.pre_med_track || "",
          bio: data.bio || "",
          career_goals: data.career_goals || "",
          research_experience: data.research_experience || "",
          linkedin_url: data.linkedin_url || "",
          resume_url: data.resume_url || "",
          email_opt_in: data.email_opt_in || false,
        });

        if (data.resume_url) {
          const signedUrl = await getSignedResumeUrl(data.resume_url);
          setResumeSignedUrl(signedUrl);
        }

        setTimeout(() => markAsSaved(), 100);
      }
    } catch (error: unknown) {
      logger.error("Error loading profile", error);
      toast.error(sanitizeErrorMessage(error));
    }
  };

  const handleUploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) {
        setUploading(false);
        return;
      }

      const file = e.target.files[0];
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size must be less than 5MB. Please choose a smaller file.");
        setUploading(false);
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const allowedExtensions = ["pdf", "doc", "docx"];
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileType = file.type.toLowerCase();

      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        toast.error("Invalid file type. Please upload a PDF, DOC, or DOCX file.");
        setUploading(false);
        return;
      }

      if (fileType && !allowedTypes.some((type) => fileType.includes(type.split("/")[1]))) {
        logger.warn("File MIME type doesn't match extension", { fileType, fileExt });
      }

      const filePath = `${user?.id}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, file);
      if (uploadError) throw uploadError;

      setProfile({ ...profile, resume_url: filePath });
      const signedUrl = await getSignedResumeUrl(filePath);
      setResumeSignedUrl(signedUrl);
      toast.success("Resume uploaded successfully!");
    } catch (error: unknown) {
      logger.error("Error uploading resume", error);
      toast.error(sanitizeErrorMessage(error) || "Failed to upload resume. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user?.id) {
        toast.error("You must be signed in to update your profile");
        setLoading(false);
        return;
      }

      const phoneValidation = validatePhoneNumber(profile.phone);
      if (!phoneValidation.valid) {
        toast.error(phoneValidation.error || "Invalid phone number");
        setLoading(false);
        return;
      }

      const gpaValidation = validateGPA(profile.gpa);
      if (!gpaValidation.valid) {
        toast.error(gpaValidation.error || "Invalid GPA");
        setLoading(false);
        return;
      }

      const yearValidation = validateGraduationYear(profile.graduation_year);
      if (!yearValidation.valid) {
        toast.error(yearValidation.error || "Invalid graduation year");
        setLoading(false);
        return;
      }

      const linkedInValidation = validateLinkedInURL(profile.linkedin_url);
      if (!linkedInValidation.valid) {
        toast.error(linkedInValidation.error || "Invalid LinkedIn URL");
        setLoading(false);
        return;
      }

      const sanitizedData = sanitizeProfileData(profile);

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: sanitizedData.full_name,
        city: sanitizedData.city,
        state: sanitizedData.state,
        phone: sanitizedData.phone,
        university: sanitizedData.university,
        major: sanitizedData.major,
        gpa: sanitizedData.gpa ? parseFloat(String(sanitizedData.gpa)) : null,
        graduation_year: sanitizedData.graduation_year
          ? parseInt(String(sanitizedData.graduation_year))
          : null,
        clinical_hours: sanitizedData.clinical_hours
          ? parseInt(String(sanitizedData.clinical_hours))
          : 0,
        pre_med_track: sanitizedData.pre_med_track,
        bio: sanitizedData.bio,
        career_goals: sanitizedData.career_goals,
        research_experience: sanitizedData.research_experience,
        linkedin_url: sanitizedData.linkedin_url,
        resume_url: sanitizedData.resume_url,
        email_opt_in: profile.email_opt_in,
      });

      if (error) throw error;

      const updatedFields = Object.keys(sanitizedData).filter(
        (key) => sanitizedData[key] !== undefined
      );
      logProfileUpdate(updatedFields);
      clearSavedData();
      markAsSaved();
      toast.success("Profile updated successfully!");
    } catch (error: unknown) {
      logger.error("Error updating profile", error);
      toast.error(sanitizeErrorMessage(error) || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_user_account" as any);
      if (error) throw error;

      toast.success("Account deleted successfully.");
      await signOut();
      navigate("/");
    } catch (error: unknown) {
      logger.error("Error deleting account", error);
      toast.error(
        "Failed to delete account. Please contact support at support@clinicalhours.org."
      );
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setDeleteConfirmText("");
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;
      toast.success("Subscription cancelled. You'll retain access until the end of your billing period.");
      setCancelModalOpen(false);
    } catch (error: unknown) {
      logger.error("Error cancelling subscription", error);
      toast.error("Failed to cancel subscription. Please contact support.");
    } finally {
      setCancelling(false);
    }
  };

  const isFieldRequired = (fieldKey: string) => {
    return REQUIRED_FIELDS.some((f) => f.key === fieldKey);
  };

  const RequiredBadge = () => <span className="text-destructive ml-1">*</span>;

  if (authLoading || !isReady || (user && (hospitalLoading || memberLoading))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Hospital profile view
  const isHospitalUser = !!hospitalMember;
  if (isHospitalUser && hospitalMember) {
    const statusLabels: Record<string, string> = {
      approved: "Approved",
      pending: "Pending Approval",
      rejected: "Rejected",
    };
    const statusColors: Record<string, string> = {
      approved: "bg-green-500/15 text-green-600 border-green-500/30",
      pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
      rejected: "bg-red-500/15 text-red-600 border-red-500/30",
    };
    const roleLabels: Record<string, string> = {
      owner: "Owner",
      admin: "Admin",
      viewer: "Viewer",
    };
    return (
      <CinematicLayout title="Settings" subtitle="Manage your hospital account and preferences">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Hospital Information
              </CardTitle>
              <CardDescription>
                {hospitalAccount
                  ? "Details for your hospital account"
                  : `You have access to this hospital as ${roleLabels[hospitalMember.role] ?? hospitalMember.role}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hospitalAccount && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Account Status</span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full border ${statusColors[hospitalAccount.account_status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {statusLabels[hospitalAccount.account_status] ??
                        hospitalAccount.account_status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Hospital Name</Label>
                    <p className="font-medium">
                      {hospitalAccount.hospital_name || hospitalMember.hospitalName || "—"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact Email
                    </Label>
                    <p>{hospitalAccount.contact_email || "—"}</p>
                  </div>
                  {hospitalAccount.contact_phone && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Contact Phone
                      </Label>
                      <p>{hospitalAccount.contact_phone}</p>
                    </div>
                  )}
                  {hospitalAccount.website && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </Label>
                      <a
                        href={
                          hospitalAccount.website.startsWith("http")
                            ? hospitalAccount.website
                            : `https://${hospitalAccount.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {hospitalAccount.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {hospitalAccount.address && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address
                      </Label>
                      <p>{hospitalAccount.address}</p>
                    </div>
                  )}
                  {hospitalAccount.description && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="text-sm">{hospitalAccount.description}</p>
                    </div>
                  )}
                </>
              )}
              {!hospitalAccount && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Hospital Name</Label>
                  <p className="font-medium">{hospitalMember.hospitalName || "—"}</p>
                </div>
              )}
              <div className="pt-4">
                <Button variant="outline" asChild>
                  <Link to="/hospital-dashboard">Go to Hospital Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-destructive">Sign Out</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign out of your account on this device
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleSignOut}
                  className="w-full sm:w-auto"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CinematicLayout>
    );
  }

  return (
    <CinematicLayout title="Settings" subtitle="Manage your profile, subscription, and account preferences">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ──────────── Profile Section (Collapsible) ──────────── */}
        <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Profile</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Name, school, bio, resume, and contact info
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6">
                {/* Profile Completeness */}
                <div
                  className={`rounded-lg p-4 ${isProfileComplete ? "border border-primary/50 bg-primary/5" : "border border-destructive/30 bg-destructive/5"}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${isProfileComplete ? "bg-primary/20" : "bg-destructive/20"}`}
                    >
                      {isProfileComplete ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">
                          {isProfileComplete ? "Profile Complete!" : "Complete Your Profile"}
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          {completeness.filledCount}/{completeness.total} required fields
                        </span>
                      </div>
                      <Progress value={completeness.percentage} className="h-2" />
                      {!isProfileComplete && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Fill in the required fields to participate in reviews and Q&A.
                          Missing: {completeness.missingFields.map((f) => f.label).join(", ")}
                        </p>
                      )}
                      {isProfileComplete && (
                        <p className="text-sm text-muted-foreground mt-2">
                          You can now leave reviews and participate in Q&A discussions.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Author Card Preview */}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium mb-2">Your Author Card Preview</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    This is how you'll appear in reviews and Q&A discussions
                  </p>
                  <UserProfileBadge
                    fullName={profile.full_name || null}
                    university={profile.university || null}
                    major={profile.major || null}
                    graduationYear={
                      profile.graduation_year ? parseInt(profile.graduation_year) : null
                    }
                    clinicalHours={
                      profile.clinical_hours ? parseInt(profile.clinical_hours) : null
                    }
                    variant="full"
                  />
                </div>

                {/* Auto-save status */}
                <div className="flex items-center justify-end gap-2 text-sm">
                  {autoSaveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                      <Cloud className="h-4 w-4" />
                      Saving...
                    </span>
                  )}
                  {autoSaveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-green-600">
                      <Check className="h-4 w-4" />
                      Saved
                    </span>
                  )}
                  {autoSaveStatus === "unsaved" && (
                    <span className="flex items-center gap-1.5 text-amber-600">
                      <Cloud className="h-4 w-4" />
                      Unsaved changes
                    </span>
                  )}
                  {autoSaveStatus === "error" && (
                    <span className="flex items-center gap-1.5 text-destructive">
                      <CloudOff className="h-4 w-4" />
                      Save failed
                    </span>
                  )}
                  {autoSaveStatus === "idle" && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Check className="h-4 w-4" />
                      Auto-save on
                    </span>
                  )}
                </div>

                {/* Profile Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Basic Information</h3>
                    <p className="text-xs text-muted-foreground -mt-2">
                      Fields marked with <span className="text-destructive">*</span> are required. Changes are saved automatically.
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        Email Address
                      </Label>
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          value={user?.email || ""}
                          disabled
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          Cannot be changed
                        </span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">
                          Full Name
                          {isFieldRequired("full_name") && <RequiredBadge />}
                        </Label>
                        <Input
                          id="full_name"
                          value={profile.full_name}
                          onChange={(e) =>
                            setProfile({ ...profile, full_name: e.target.value.slice(0, 100) })
                          }
                          maxLength={100}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={profile.phone}
                          onChange={(e) =>
                            setProfile({ ...profile, phone: e.target.value.slice(0, 20) })
                          }
                          maxLength={20}
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <CityAutocomplete
                          value={profile.city}
                          onValueChange={(value) => setProfile({ ...profile, city: value })}
                          placeholder="Search for a city..."
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <DatalistInput
                          id="state"
                          value={profile.state}
                          onValueChange={(value) => setProfile({ ...profile, state: value })}
                          options={US_STATES}
                          placeholder="Type or select state..."
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Academic Information</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="university">
                          University
                          {isFieldRequired("university") && <RequiredBadge />}
                        </Label>
                        <DatalistInput
                          id="university"
                          value={profile.university}
                          onValueChange={(value) => setProfile({ ...profile, university: value })}
                          options={COMMON_UNIVERSITIES}
                          placeholder="Type or select university..."
                          disabled={loading}
                          allowCustom={true}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="major">
                          Major
                          {isFieldRequired("major") && <RequiredBadge />}
                        </Label>
                        <DatalistInput
                          id="major"
                          value={profile.major}
                          onValueChange={(value) => setProfile({ ...profile, major: value })}
                          options={COMMON_MAJORS}
                          placeholder="Type or select major..."
                          disabled={loading}
                          allowCustom={true}
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gpa">GPA</Label>
                        <Input
                          id="gpa"
                          type="number"
                          step="0.01"
                          min="0"
                          max="4"
                          value={profile.gpa}
                          onChange={(e) => setProfile({ ...profile, gpa: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="graduation_year">
                          Graduation Year
                          {isFieldRequired("graduation_year") && <RequiredBadge />}
                        </Label>
                        <DatalistInput
                          id="graduation_year"
                          value={profile.graduation_year}
                          onValueChange={(value) =>
                            setProfile({ ...profile, graduation_year: value })
                          }
                          options={graduationYears.map(String)}
                          placeholder="Type or select graduation year..."
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinical_hours">Clinical Hours</Label>
                        <Input
                          id="clinical_hours"
                          type="number"
                          value={profile.clinical_hours}
                          onChange={(e) =>
                            setProfile({ ...profile, clinical_hours: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pre_med_track">Pre-Med Track</Label>
                      <Input
                        id="pre_med_track"
                        value={profile.pre_med_track}
                        onChange={(e) =>
                          setProfile({ ...profile, pre_med_track: e.target.value.slice(0, 100) })
                        }
                        placeholder="e.g., Traditional, Post-Bacc, Career Changer"
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {/* Professional Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Professional Information</h3>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={profile.bio}
                        onChange={(e) =>
                          setProfile({ ...profile, bio: e.target.value.slice(0, 2000) })
                        }
                        placeholder="Tell us about yourself..."
                        rows={4}
                        maxLength={2000}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {profile.bio.length}/2000 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="career_goals">Career Goals</Label>
                      <Textarea
                        id="career_goals"
                        value={profile.career_goals}
                        onChange={(e) =>
                          setProfile({ ...profile, career_goals: e.target.value.slice(0, 2000) })
                        }
                        placeholder="What are your medical career aspirations?"
                        rows={3}
                        maxLength={2000}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {profile.career_goals.length}/2000 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="research_experience">Research Experience</Label>
                      <Textarea
                        id="research_experience"
                        value={profile.research_experience}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            research_experience: e.target.value.slice(0, 2000),
                          })
                        }
                        placeholder="Describe your research experience..."
                        rows={3}
                        maxLength={2000}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {profile.research_experience.length}/2000 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                      <Input
                        id="linkedin_url"
                        type="url"
                        value={profile.linkedin_url}
                        onChange={(e) =>
                          setProfile({ ...profile, linkedin_url: e.target.value.slice(0, 500) })
                        }
                        placeholder="https://linkedin.com/in/yourprofile"
                        maxLength={500}
                      />
                    </div>
                  </div>

                  {/* Resume Upload */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Resume</h3>
                    <div className="space-y-2">
                      <Label htmlFor="resume">Upload Resume</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="resume"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleUploadResume}
                          disabled={uploading}
                          className="flex-1"
                        />
                        {uploading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                      </div>
                      {profile.resume_url && resumeSignedUrl && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          Current resume:{" "}
                          <button
                            type="button"
                            onClick={handleResumeView}
                            className="text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            Download Resume <ExternalLink className="h-3 w-3" />
                          </button>
                        </p>
                      )}
                    </div>
                  </div>
                </form>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ──────────── Settings Section (Collapsible) ──────────── */}
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Settings</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Subscription, notifications, and account actions
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6">
                {/* Subscription Management */}
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Subscription</h3>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Current Plan</p>
                      <div className="flex items-center gap-2">
                        {isPremium ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-sm text-amber-400 font-medium">
                              <Sparkles className="h-3.5 w-3.5" />
                              Premium
                            </span>
                            {premiumExpiresAt && (
                              <span className="text-xs text-muted-foreground">
                                (access until{" "}
                                {new Date(premiumExpiresAt).toLocaleDateString()})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Free</span>
                        )}
                      </div>
                    </div>

                    {isPremium ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => setCancelModalOpen(true)}
                      >
                        Cancel Subscription
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" className="gap-1.5" asChild>
                        <Link to="/premium">
                          Upgrade <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Notifications */}
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Notifications</h3>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-opt-in-toggle" className="font-medium text-sm">
                        Email Updates
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Receive updates about new clinical opportunities and platform features
                      </p>
                    </div>
                    <Switch
                      id="email-opt-in-toggle"
                      checked={profile.email_opt_in}
                      onCheckedChange={(checked) => {
                        setProfile({ ...profile, email_opt_in: checked });
                      }}
                    />
                  </div>
                </div>

                {/* Account Actions */}
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Account</h3>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Sign Out</p>
                      <p className="text-xs text-muted-foreground">
                        Sign out of your account on this device
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-3.5 w-3.5" />
                      Log Out
                    </Button>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">Delete Account</p>
                        <p className="text-xs text-muted-foreground">
                          Permanently delete your account and all associated data
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteModalOpen(true)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Delete Account Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={(open) => {
        setDeleteModalOpen(open);
        if (!open) setDeleteConfirmText("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This action is permanent. All your data, saved opportunities, and application
              history will be deleted forever.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">DELETE</span> to
              confirm.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel? You'll lose access to premium features at the end
              of your billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={cancelling}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CinematicLayout>
  );
};

export default Settings;
