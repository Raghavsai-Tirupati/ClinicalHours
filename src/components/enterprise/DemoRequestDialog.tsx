import { useState, type ReactNode } from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DemoRequestDialogProps {
  /** Element that opens the dialog when clicked. */
  children: ReactNode;
}

interface FormState {
  name: string;
  email: string;
  clinic: string;
  role: string;
  message: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  email: "",
  clinic: "",
  role: "",
  message: "",
};

/**
 * Demo request modal — used by every "Request a demo" CTA on the
 * enterprise page. Posts the form into the existing send-contact-email
 * edge function so emails work immediately on prod (no new function to
 * deploy). Owner receives a notification email; the visitor receives a
 * confirmation reply.
 */
export function DemoRequestDialog({ children }: DemoRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setState((s) => ({ ...s, [key]: e.target.value }));
  };

  const reset = () => {
    setState(INITIAL_STATE);
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const name = state.name.trim();
    const email = state.email.trim();
    const clinic = state.clinic.trim();
    const role = state.role.trim();
    const message = state.message.trim();

    if (!name || !email || !clinic) {
      toast.error("Name, email, and organization are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    const subject = `[Enterprise Demo Request] ${clinic} — ${name}`;
    const body = [
      `Name:         ${name}`,
      `Work email:   ${email}`,
      `Organization: ${clinic}`,
      role ? `Role:         ${role}` : null,
      "",
      "----- Message -----",
      message || "(no additional notes)",
    ]
      .filter((line) => line !== null)
      .join("\n");

    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: { name, email, subject, message: body },
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("Thanks — we'll be in touch within one business day.");
    } catch (err) {
      console.error("Demo request failed:", err);
      // Fallback path: open the user's email client so the lead isn't lost.
      const fallback = `mailto:enterprise@clinicalhours.org?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
      toast.error(
        "Couldn't reach our server. Opening your email app as a fallback.",
      );
      window.location.href = fallback;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          // Slight delay so the closing animation finishes before we wipe state
          setTimeout(reset, 200);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-white text-zinc-900 border-zinc-200">
        {submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="py-6 flex flex-col items-center text-center"
          >
            <CheckCircle2
              className="h-10 w-10 text-emerald-600 mb-4"
              strokeWidth={1.5}
            />
            <h3 className="font-sans text-xl font-semibold mb-2">
              Request received.
            </h3>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-sm">
              We'll reach out within one business day. Check your inbox for a
              confirmation from{" "}
              <span className="text-zinc-900 font-medium">
                support@clinicalhours.org
              </span>
              .
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 text-[11px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Close
            </button>
          </motion.div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-sans text-xl sm:text-2xl font-semibold tracking-tight">
                Request a demo
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                Tell us a little about your clinic. We'll follow up within one
                business day.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="mt-2 space-y-4">
              <Field id="dr-name" label="Name">
                <Input
                  id="dr-name"
                  required
                  autoComplete="name"
                  maxLength={100}
                  value={state.name}
                  onChange={update("name")}
                  className="bg-white border-zinc-200 focus-visible:ring-zinc-900"
                />
              </Field>

              <Field id="dr-email" label="Work email">
                <Input
                  id="dr-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={255}
                  value={state.email}
                  onChange={update("email")}
                  className="bg-white border-zinc-200 focus-visible:ring-zinc-900"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="dr-clinic" label="Clinic / organization">
                  <Input
                    id="dr-clinic"
                    required
                    autoComplete="organization"
                    maxLength={150}
                    value={state.clinic}
                    onChange={update("clinic")}
                    className="bg-white border-zinc-200 focus-visible:ring-zinc-900"
                  />
                </Field>

                <Field
                  id="dr-role"
                  label={<>Role <span className="text-zinc-400 normal-case">(optional)</span></>}
                >
                  <Input
                    id="dr-role"
                    autoComplete="organization-title"
                    placeholder="Coordinator, Director, …"
                    maxLength={100}
                    value={state.role}
                    onChange={update("role")}
                    className="bg-white border-zinc-200 focus-visible:ring-zinc-900"
                  />
                </Field>
              </div>

              <Field
                id="dr-message"
                label={<>Anything we should know? <span className="text-zinc-400 normal-case">(optional)</span></>}
              >
                <Textarea
                  id="dr-message"
                  rows={3}
                  maxLength={2000}
                  placeholder="Number of credentialed workers, biggest pain point, timeline…"
                  value={state.message}
                  onChange={update("message")}
                  className="bg-white border-zinc-200 focus-visible:ring-zinc-900 resize-none"
                />
              </Field>

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  By submitting you agree to be contacted by ClinicalHours.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] px-6 py-3 bg-zinc-900 text-white transition-colors duration-150",
                    submitting
                      ? "opacity-70 cursor-wait"
                      : "hover:bg-zinc-800",
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending
                    </>
                  ) : (
                    <>
                      Send request
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  id: string;
  label: ReactNode;
  children: ReactNode;
}

function Field({ id, label, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

export default DemoRequestDialog;
