import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Loader2, Linkedin, Clock, MessageCircle, HelpCircle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useAuth } from "@/hooks/useAuth";
import { MAX_LENGTHS, validateEmail } from "@/lib/inputValidation";
// CSRF protection is handled by Supabase's built-in JWT token validation

const Contact = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isStudentFeedback = searchParams.get("intent") === "student-feedback";
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [messagePlaceholder, setMessagePlaceholder] = useState("Tell us more...");
  const [emailError, setEmailError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Auto-save contact form data
  const { loadSavedData, clearSavedData } = useAutoSave(formData, "contact-form-draft", true);

  // Load saved draft on mount; apply student-feedback pre-fill when linked from dashboard
  useEffect(() => {
    const savedDraft = loadSavedData();
    const base = savedDraft ?? { name: "", email: "", subject: "", message: "" };

    if (isStudentFeedback) {
      const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
      setFormData({
        name: base.name || fullName,
        email: base.email || user?.email || "",
        subject: "Student platform feedback",
        message: base.message,
      });
      setMessagePlaceholder("What should we fix, add, or make easier?");
    } else if (savedDraft) {
      setFormData(savedDraft);
    }
  }, [isStudentFeedback, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }

    // Validate email before submitting
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error || "Invalid email address");
      toast({
        title: "Invalid email",
        description: emailValidation.error || "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: formData,
      });

      if (error) throw error;

      toast({
        title: "Message Sent!",
        description: "Thank you for reaching out. We'll get back to you soon.",
      });
      // Clear form and auto-saved draft
      setFormData({ name: "", email: "", subject: "", message: "" });
      clearSavedData();
    } catch (error: unknown) {
      logger.error("Error sending message", error);
      toast({
        title: "Error",
        description: sanitizeErrorMessage(error) || "Failed to send message. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Sanitize and limit input lengths using shared max length constants
    let sanitizedValue = value;
    if (name === "name") sanitizedValue = value.slice(0, MAX_LENGTHS.CONTACT_NAME);
    if (name === "email") {
      sanitizedValue = value.slice(0, MAX_LENGTHS.CONTACT_EMAIL);
      // Clear email error as user edits
      if (emailError) {
        setEmailError(null);
      }
    }
    if (name === "subject") sanitizedValue = value.slice(0, MAX_LENGTHS.CONTACT_SUBJECT);
    if (name === "message") sanitizedValue = value.slice(0, MAX_LENGTHS.CONTACT_MESSAGE);
    setFormData({ ...formData, [name]: sanitizedValue });
  };

  const handleEmailBlur = () => {
    const result = validateEmail(formData.email);
    if (!result.valid) {
      setEmailError(result.error || "Invalid email address");
    } else {
      setEmailError(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Contact ClinicalHours — Support & Partnerships</title>
        <meta name="description" content="Contact the ClinicalHours team for support, partnerships, or questions about clinical volunteer opportunities. We respond within 24-48 hours." />
        <link rel="canonical" href="https://clinicalhours.lovable.app/contact" />
        <meta property="og:title" content="Contact ClinicalHours — Support & Partnerships" />
        <meta property="og:description" content="Contact the ClinicalHours team for support, partnerships, or questions about clinical volunteer opportunities." />
        <meta property="og:url" content="https://clinicalhours.lovable.app/contact" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "How do I add a new clinical opportunity?", acceptedAnswer: { "@type": "Answer", text: "If you know of a clinical opportunity that's not listed on our platform, please contact us with the details. We'll verify the information and add it to help other students." } },
            { "@type": "Question", name: "Can I update information about an existing opportunity?", acceptedAnswer: { "@type": "Answer", text: "Yes! If you notice incorrect information about an opportunity, please let us know. We rely on our community to keep the platform accurate and up-to-date." } },
            { "@type": "Question", name: "How can I contribute to ClinicalHours?", acceptedAnswer: { "@type": "Answer", text: "We welcome contributions! You can help by submitting reviews, sharing opportunities, answering questions, or suggesting new features. Reach out to discuss partnership opportunities." } },
            { "@type": "Question", name: "Is ClinicalHours free to use?", acceptedAnswer: { "@type": "Answer", text: "Yes, ClinicalHours is completely free for students. Our mission is to make clinical opportunities accessible to all pre-med students, regardless of their background or resources." } },
            { "@type": "Question", name: "I'm having trouble with my account. What should I do?", acceptedAnswer: { "@type": "Answer", text: "If you're experiencing account issues, please contact us with your email address and a description of the problem. We'll help you resolve it as quickly as possible." } },
          ],
        })}</script>
      </Helmet>
      <Navigation />

      <div className="container mx-auto px-4 pt-28 pb-24 md:pb-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 scroll-mt-28">Get In Touch</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions about clinical opportunities, want to contribute to the platform, or need help with your account? We're here to help and would love to hear from you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Contact Info Cards */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Mail className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Email</CardTitle>
                  <CardDescription>Send us an email anytime</CardDescription>
                </CardHeader>
                <CardContent>
                  <a 
                    href="mailto:support@clinicalhours.org" 
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    support@clinicalhours.org
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    We typically respond within 24-48 hours
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Linkedin className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">LinkedIn</CardTitle>
                  <CardDescription>Connect with us on LinkedIn</CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href="https://linkedin.com/company/clinicalhours"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-2"
                  >
                    <Linkedin className="h-4 w-4" />
                    Follow ClinicalHours
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Stay updated with platform news and updates
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <MapPin className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Location</CardTitle>
                  <CardDescription>Based in Dallas, Texas</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Dallas, Texas, United States</p>
                </CardContent>
              </Card>
            </div>

            {/* What We Can Help With */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <HelpCircle className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">What We Can Help With</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Questions about finding clinical opportunities</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Account or profile issues</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Reporting incorrect opportunity information</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Partnership or collaboration inquiries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Feature requests or feedback</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>General questions about the platform</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Clock className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    We aim to respond to all inquiries within <strong className="text-foreground">24-48 hours</strong> during business days. For urgent matters, please include "URGENT" in your subject line.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Send className="h-6 w-6 text-primary" />
                <CardTitle>Send a Message</CardTitle>
              </div>
              <CardDescription>Fill out the form below and we'll respond as soon as possible. All fields are required.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      required
                      maxLength={MAX_LENGTHS.CONTACT_NAME}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.name.length}/{MAX_LENGTHS.CONTACT_NAME} characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                      required
                      maxLength={MAX_LENGTHS.CONTACT_EMAIL}
                      onBlur={handleEmailBlur}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.email.length}/{MAX_LENGTHS.CONTACT_EMAIL} characters
                    </p>
                    {emailError && (
                      <p className="text-xs text-destructive mt-1">
                        {emailError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="What is this about?"
                    required
                    maxLength={MAX_LENGTHS.CONTACT_SUBJECT}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formData.subject.length}/{MAX_LENGTHS.CONTACT_SUBJECT} characters
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder={messagePlaceholder}
                    rows={6}
                    required
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formData.message.length}/5000 characters
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    By submitting this form, you agree to our{" "}
                    <a href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                    {" "}and{" "}
                    <a href="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </a>
                    .
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <div className="mt-12">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-6 w-6 text-primary" />
                  <CardTitle>Frequently Asked Questions</CardTitle>
                </div>
                <CardDescription>Quick answers to common questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">How do I add a new clinical opportunity?</h3>
                    <p className="text-sm text-muted-foreground">
                      If you know of a clinical opportunity that's not listed on our platform, please contact us with the details. We'll verify the information and add it to help other students.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Can I update information about an existing opportunity?</h3>
                    <p className="text-sm text-muted-foreground">
                      Yes! If you notice incorrect information about an opportunity, please let us know. We rely on our community to keep the platform accurate and up-to-date.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">How can I contribute to ClinicalHours?</h3>
                    <p className="text-sm text-muted-foreground">
                      We welcome contributions! You can help by submitting reviews, sharing opportunities, answering questions, or suggesting new features. Reach out to discuss partnership opportunities.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Is ClinicalHours free to use?</h3>
                    <p className="text-sm text-muted-foreground">
                      Yes, ClinicalHours is completely free for students. Our mission is to make clinical opportunities accessible to all pre-med students, regardless of their background or resources.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">I'm having trouble with my account. What should I do?</h3>
                    <p className="text-sm text-muted-foreground">
                      If you're experiencing account issues, please contact us with your email address and a description of the problem. We'll help you resolve it as quickly as possible.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Contact;
