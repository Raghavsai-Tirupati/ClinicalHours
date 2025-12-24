import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Star, User } from "lucide-react";
import { format } from "date-fns";

interface Review {
  id: string;
  rating: number;
  overall_experience: number | null;
  acceptance_difficulty: number | null;
  staff_friendliness: number | null;
  learning_opportunities: number | null;
  comment: string | null;
  created_at: string;
  user_id: string;
}

interface ReviewsListProps {
  opportunityId: string;
  refreshTrigger?: number;
}

const ReviewsList = ({ opportunityId, refreshTrigger }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("reviews")
          .select("*")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setReviews(data || []);
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [opportunityId, refreshTrigger]);

  const StarDisplay = ({ rating }: { rating: number }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? "fill-primary text-primary" : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading reviews...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No reviews yet. Be the first to share your experience!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">
        {reviews.length} Review{reviews.length !== 1 ? "s" : ""}
      </h4>
      {reviews.map((review) => (
        <Card key={review.id} className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Anonymous Student</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(review.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
              <StarDisplay rating={review.rating} />
            </div>

            {review.comment && (
              <p className="text-sm text-foreground mb-3">{review.comment}</p>
            )}

            {/* Show individual ratings if provided */}
            <div className="flex flex-wrap gap-4 text-xs">
              {review.overall_experience && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Experience:</span>
                  <StarDisplay rating={review.overall_experience} />
                </div>
              )}
              {review.staff_friendliness && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Staff:</span>
                  <StarDisplay rating={review.staff_friendliness} />
                </div>
              )}
              {review.learning_opportunities && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Learning:</span>
                  <StarDisplay rating={review.learning_opportunities} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ReviewsList;
