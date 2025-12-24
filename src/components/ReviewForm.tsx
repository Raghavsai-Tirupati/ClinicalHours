import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState<RatingCategory[]>([
    { key: "rating", label: "Overall Rating", value: 0 },
    { key: "overall_experience", label: "Overall Experience", value: 0 },
    { key: "acceptance_difficulty", label: "Acceptance Difficulty", value: 0 },
    { key: "staff_friendliness", label: "Staff Friendliness", value: 0 },
    { key: "learning_opportunities", label: "Learning Opportunities", value: 0 },
  ]);

  const handleRatingChange = (key: string, value: number) => {
    setRatings(ratings.map((r) => (r.key === key ? { ...r, value } : r)));
  };

  const handleSubmit = async () => {
    const overallRating = ratings.find((r) => r.key === "rating")?.value || 0;
    if (overallRating === 0) {
      toast.error("Please provide at least an overall rating");
      return;
    }

    setLoading(true);
    try {
      const reviewData: any = {
        opportunity_id: opportunityId,
        user_id: user?.id,
        rating: overallRating,
        comment: comment || null,
      };

      // Add optional ratings if they were provided
      ratings.forEach((r) => {
        if (r.key !== "rating" && r.value > 0) {
          reviewData[r.key] = r.value;
        }
      });

      const { error } = await supabase.from("reviews").insert(reviewData);

      if (error) throw error;

      toast.success("Review submitted successfully!");
      setOpen(false);
      setComment("");
      setRatings(ratings.map((r) => ({ ...r, value: 0 })));
      onReviewSubmitted();
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast.error("Failed to submit review: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Star className="mr-2 h-4 w-4" />
          Write Review
        </Button>
      </DialogTrigger>
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
            />
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
  );
};

export default ReviewForm;
