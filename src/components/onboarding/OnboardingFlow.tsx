import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingFlowProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = ['role', 'info', 'action'] as const;
type Step = typeof STEPS[number];

export function OnboardingFlow({ open, onComplete, onSkip }: OnboardingFlowProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('role');
  const [info, setInfo] = useState({ university: '', major: '', graduation_year: '' });
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  async function handleRoleSelect(selected: 'student' | 'hospital') {
    if (selected === 'hospital') {
      onComplete();
      navigate('/auth?hospital=true');
      return;
    }
    setStep('info');
  }

  async function handleInfoSubmit() {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({
      university: info.university || null,
      major: info.major || null,
      graduation_year: info.graduation_year ? parseInt(info.graduation_year) : null,
    }).eq('id', user.id);
    setSaving(false);
    setStep('action');
  }

  function handleActionSelect(action: 'browse' | 'profile') {
    onComplete();
    navigate(action === 'browse' ? '/opportunities' : '/profile');
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === stepIndex ? 'bg-primary' : i < stepIndex ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step: Role */}
        {step === 'role' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Welcome to ClinicalHours</h2>
              <p className="text-muted-foreground text-sm mt-1">Let's get you set up. What best describes you?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleRoleSelect('student')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Student</div>
                <div className="text-xs text-muted-foreground mt-1">Pre-med or clinical student seeking hours</div>
              </button>
              <button
                onClick={() => handleRoleSelect('hospital')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Clinical Site</div>
                <div className="text-xs text-muted-foreground mt-1">Hospital or clinic posting opportunities</div>
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={onSkip} className="w-full">
              Skip for now
            </Button>
          </div>
        )}

        {/* Step: Info */}
        {step === 'info' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Your Academic Info</h2>
              <p className="text-muted-foreground text-sm mt-1">This helps match you with relevant opportunities. All optional.</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="university">University</Label>
                <Input
                  id="university"
                  placeholder="e.g. University of Texas"
                  value={info.university}
                  onChange={(e) => setInfo(p => ({ ...p, university: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="major">Major</Label>
                <Input
                  id="major"
                  placeholder="e.g. Biology"
                  value={info.major}
                  onChange={(e) => setInfo(p => ({ ...p, major: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="grad-year">Graduation Year</Label>
                <Input
                  id="grad-year"
                  placeholder="e.g. 2027"
                  type="number"
                  value={info.graduation_year}
                  onChange={(e) => setInfo(p => ({ ...p, graduation_year: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onSkip} className="flex-1">Skip</Button>
              <Button onClick={handleInfoSubmit} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Step: First Action */}
        {step === 'action' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">You're all set!</h2>
              <p className="text-muted-foreground text-sm mt-1">What would you like to do first?</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleActionSelect('browse')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Browse Opportunities</div>
                <div className="text-xs text-muted-foreground mt-1">Find clinical hours near you</div>
              </button>
              <button
                onClick={() => handleActionSelect('profile')}
                className="border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <div className="font-medium">Complete My Profile</div>
                <div className="text-xs text-muted-foreground mt-1">Add your details to unlock all features</div>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
