import { useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmailVerified } from "@/hooks/useEmailVerified";
import { useProfileComplete } from "@/hooks/useProfileComplete";
import { ProfileGate } from "@/components/ProfileGate";
import { GuestGate } from "@/components/GuestGate";
import { VerificationGate } from "@/components/VerificationGate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkRateLimit } from "@/lib/rateLimit";
import { sanitizeErrorMessage } from "@/lib/errorUtils";
import { logger } from "@/lib/logger";
import type { ReviewData, SupabaseError } from "@/types";

interface ReviewFormProps {
  opportunityId: string;
  opportunityName: string;
  onReviewSubmitted: () => void;
}

interface RatingCategory {
  key: string;
  label: string;
  value: number;
}

const ReviewForm = ({ opportunityId, opportunityName, onReviewSubmitted }: ReviewFormProps) => {
  const { user, isGuest } = useAuth();
  const { needsVerification } = useEmailVerified();
  const { isComplete, isLoading: profileLoading, missingFields } = useProfileComplete();
  const [open, setOpen] = useState(false);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [showVerificationGate, setShowVerificationGate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState<RatingCategory[]>([
    { key: "rating", label: "Overall Rating", value: 0 },
    { key: "overall_experience", label: "Overall Experience", value: 0 },
    { key: "acceptance_difficulty", label: "Acceptance Difficulty", value: 0 },
    { key: "staff_friendliness", label: "Staff Friendliness", value: 0 },
    { key: "learning_opportunities", label: "Learning Opportunities", value: 0 },
  ]);
  const isSubmittingRef = useRef(false);

  const handleRatingChange = useCallback((key: string, value: number) => {
    setRatings((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
  }, []);

  // Memoize overall rating calculation
  const overallRating = useMemo(() => {
    return ratings.find((r) => r.key === "rating")?.value || 0;
  }, [ratings]);

  const handleOpenReviewDialog = () => {
    if (isGuest) {
      setShowGuestGate(true);
      return;
    }
    if (needsVerification) {
      setShowVerificationGate(true);
      return;
    }

    if (!user) {
      toast.error("Please sign in to write a review");
      return;
    }

    // CSRF protection is handled by Supabase's built-in JWT token validation

    // No profile check here - let user fill out the form first
    setOpen(true);
  };

  const handleSubmit = useCallback(async () => {
    if (overallRating === 0) {
      toast.error("Please provide at least an overall rating");
      return;
    }

    if (!user?.id) {
      toast.error("Please sign in to submit a review");
      return;
    }

    // Prevent double submission
    if (isSubmittingRef.current || loading) {
      return;
    }
    
    isSubmittingRef.current = true;

    // Check profile completion at submission time - fetch fresh data
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, university, major, graduation_year")
        .eq("id", user.id)
        .single();

      if (profileError) {
        toast.error("Error verifying profile");
        setLoading(false);
        return;
      }

      // Check required fields
      const REQUIRED_FIELDS = [
        { key: "full_name", label: "Full Name" },
        { key: "university", label: "University" },
        { key: "major", label: "Major" },
        { key: "graduation_year", label: "Graduation Year" },
      ];

      const missing: string[] = [];
      REQUIRED_FIELDS.forEach(({ key, label }) => {
        const value = profileData?.[key as keyof typeof profileData];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          missing.push(label);
        }
      });

      if (missing.length > 0) {
        setShowProfileGate(true);
        setOpen(false);
        setLoading(false);
        return;
      }
    } catch (error) {
      logger.error("Error checking profile", error);
      toast.error("Error verifying profile");
      setLoading(false);
      return;
    }

    // Profile is complete - proceed with submission

    // Client-side rate limiting (5 reviews per hour per user)
    const rateLimitKey = `review:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      const minutesUntilReset = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      toast.error(`Rate limit exceeded. Please wait ${minutesUntilReset} minute(s) before submitting another review.`);
      return;
    }

    setLoading(true);
    try {
      // Check for existing review
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("opportunity_id", opportunityId)
        .eq("user_id", user.id)
        .single();

      if (existingReview) {
        toast.error("You have already submitted a review for this opportunity");
        setOpen(false);
        setLoading(false);
        return;
      }

      // Validate comment length (matching database constraint)
      const MAX_COMMENT_LENGTH = 2000;
      const trimmedComment = comment?.trim() || null;
      if (trimmedComment && trimmedComment.length > MAX_COMMENT_LENGTH) {
        toast.error(`Comment must be ${MAX_COMMENT_LENGTH} characters or less`);
        setLoading(false);
        return;
      }

      const reviewData: ReviewData = {
        opportunity_id: opportunityId,
        user_id: user.id,
        rating: overallRating,
        comment: trimmedComment,
      };

      // Add optional ratings if they were provided
      ratings.forEach((r) => {
        if (r.key !== "rating" && r.value > 0) {
          (reviewData as Record<string, number>)[r.key] = r.value;
        }
      });

      let { error } = await supabase.from("reviews").insert(reviewData);

      if (error) {
        logger.error("Review submission error", error);
        // Handle duplicate key error (race condition case)
        if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique")) {
          toast.error("You have already submitted a review for this opportunity");
          setOpen(false);
          setLoading(false);
          return;
        }
        throw error;
      }

      toast.success("Review submitted successfully!");
      setOpen(false);
      setComment("");
      setRatings(ratings.map((r) => ({ ...r, value: 0 })));
      onReviewSubmitted();
    } catch (error: unknown) {
      logger.error("Review submission error details", error);
      
      // Sanitize error message
      let errorMessage = sanitizeErrorMessage(error);
      
      const supabaseError = error as SupabaseError;
      if (supabaseError?.code === "23505" || supabaseError?.message?.includes("duplicate") || supabaseError?.message?.includes("already exists")) {
        errorMessage = "You have already submitted a review for this opportunity";
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [overallRating, user?.id, ratings, comment, opportunityId, onReviewSubmitted, loading]);

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(star);
            }
          }}
          className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded transition-transform hover:scale-110"
          aria-label={`Rate ${star} out of 5 stars`}
          aria-pressed={star <= value}
        >
          <Star
            className={`h-6 w-6 ${
              star <= value ? "fill-primary text-primary" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleOpenReviewDialog}
        disabled={profileLoading}
      >
        <Star className="mr-2 h-4 w-4" />
        Write Review
      </Button>

      <ProfileGate
        open={showProfileGate}
        onOpenChange={setShowProfileGate}
        missingFields={missingFields}
        action="leave a review"
      />

      <GuestGate
        open={showGuestGate}
        onOpenChange={setShowGuestGate}
        action="write a review"
      />

      <VerificationGate
        open={showVerificationGate}
        onOpenChange={setShowVerificationGate}
        action="write a review"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review {opportunityName}</DialogTitle>
            <DialogDescription>
              Share your experience to help other students
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {ratings.map((rating) => (
              <div key={rating.key} className="space-y-2">
                <Label className="text-sm font-medium">
                  {rating.label}
                  {rating.key === "rating" && <span className="text-destructive ml-1">*</span>}
                </Label>
                <StarRating
                  value={rating.value}
                  onChange={(v) => handleRatingChange(rating.key, v)}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share details about your experience..."
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {comment.length}/2000 characters
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReviewForm;
