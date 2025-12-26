import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Loader2, ExternalLink } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resumeSignedUrl, setResumeSignedUrl] = useState<string | null>(null);
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
  });

  // Generate signed URL for resume viewing
  const getSignedResumeUrl = useCallback(async (path: string) => {
    if (!path) return null;
    try {
      const { data, error } = await supabase.storage
        .from("resumes")
        .createSignedUrl(path, 3600); // Valid for 1 hour
      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error("Error getting signed URL:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (user) {
      loadProfile();
    }
  }, [user, authLoading, navigate]);

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
        });
        
        // Generate signed URL for viewing resume
        if (data.resume_url) {
          const signedUrl = await getSignedResumeUrl(data.resume_url);
          setResumeSignedUrl(signedUrl);
        }
      }
    } catch (error: any) {
      toast.error("Error loading profile: " + error.message);
    }
  };

  const handleUploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user?.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store just the file path, not a public URL
      setProfile({ ...profile, resume_url: filePath });
      
      // Generate a signed URL for viewing
      const signedUrl = await getSignedResumeUrl(filePath);
      setResumeSignedUrl(signedUrl);
      
      toast.success("Resume uploaded successfully!");
    } catch (error: any) {
      toast.error("Error uploading resume: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          city: profile.city,
          state: profile.state,
          phone: profile.phone,
          university: profile.university,
          major: profile.major,
          gpa: profile.gpa ? parseFloat(profile.gpa) : null,
          graduation_year: profile.graduation_year ? parseInt(profile.graduation_year) : null,
          clinical_hours: profile.clinical_hours ? parseInt(profile.clinical_hours) : 0,
          pre_med_track: profile.pre_med_track,
          bio: profile.bio,
          career_goals: profile.career_goals,
          research_experience: profile.research_experience,
          linkedin_url: profile.linkedin_url,
          resume_url: profile.resume_url,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error("Error updating profile: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>
              Update your information to get personalized clinical opportunity recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Academic Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="university">University</Label>
                    <Input
                      id="university"
                      value={profile.university}
                      onChange={(e) => setProfile({ ...profile, university: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      value={profile.major}
                      onChange={(e) => setProfile({ ...profile, major: e.target.value })}
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
                    <Label htmlFor="graduation_year">Graduation Year</Label>
                    <Input
                      id="graduation_year"
                      type="number"
                      value={profile.graduation_year}
                      onChange={(e) => setProfile({ ...profile, graduation_year: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical_hours">Clinical Hours</Label>
                    <Input
                      id="clinical_hours"
                      type="number"
                      value={profile.clinical_hours}
                      onChange={(e) => setProfile({ ...profile, clinical_hours: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pre_med_track">Pre-Med Track</Label>
                  <Input
                    id="pre_med_track"
                    value={profile.pre_med_track}
                    onChange={(e) => setProfile({ ...profile, pre_med_track: e.target.value })}
                    placeholder="e.g., Traditional, Post-Bacc, Career Changer"
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
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="career_goals">Career Goals</Label>
                  <Textarea
                    id="career_goals"
                    value={profile.career_goals}
                    onChange={(e) => setProfile({ ...profile, career_goals: e.target.value })}
                    placeholder="What are your medical career aspirations?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="research_experience">Research Experience</Label>
                  <Textarea
                    id="research_experience"
                    value={profile.research_experience}
                    onChange={(e) => setProfile({ ...profile, research_experience: e.target.value })}
                    placeholder="Describe your research experience..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="linkedin_url"
                    type="url"
                    value={profile.linkedin_url}
                    onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/yourprofile"
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
                      <a
                        href={resumeSignedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        View Resume <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  )}
                </div>
              </div>


              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
