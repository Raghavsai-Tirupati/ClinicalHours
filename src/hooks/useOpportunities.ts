import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Opportunity, UserLocation } from "@/types";
import { fetchOpportunities } from "@/services/opportunities";

interface UseOpportunitiesOptions {
  userLocation: UserLocation | null;
  filterType: string;
  searchTerm: string;
  pageSize?: number;
}

interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  totalCount: number;
  refetch: () => void;
}

// Distance calculation moved to src/lib/geolocation.ts

export function useOpportunities({
  userLocation,
  filterType,
  searchTerm,
  pageSize = 20,
}: UseOpportunitiesOptions): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
  }, [filterType, searchTerm, userLocation?.lat, userLocation?.lng]);

  // Fetch opportunities with server-side pagination
  const fetchOpportunitiesPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = pageNum * pageSize;
      
      // Use service layer for API call with pagination
      const { data, error, count } = await fetchOpportunities({
        filterType: filterType === "all" ? undefined : filterType,
        searchTerm: searchTerm?.trim() || undefined,
        limit: pageSize,
        offset,
        userLocation,
      });

      if (error) throw error;

      let processedData: Opportunity[] = data || [];

      // Distance is now calculated server-side when userLocation is provided
      // The data comes back already sorted by distance

      // For first page, replace data; for subsequent pages, append
      // Since server returns data already sorted by distance, we just append
      if (pageNum === 0) {
        setOpportunities(processedData);
      } else {
        setOpportunities((prev) => [...prev, ...processedData]);
      }

      // Update total count and hasMore
      const total = count || processedData.length;
      setTotalCount(total);
      setHasMore(processedData.length === pageSize && (offset + pageSize < total));
    } catch (err) {
      logger.error("Error fetching opportunities", err);
      setError("Failed to load opportunities. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [filterType, searchTerm, userLocation, pageSize, toast]);

  // Fetch opportunities when filters or page changes
  useEffect(() => {
    fetchOpportunitiesPage(page);
  }, [fetchOpportunitiesPage, page]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [loading, hasMore]);

  const refetch = useCallback(() => {
    setPage(0);
    setHasMore(true);
  }, []);

  return {
    opportunities,
    loading,
    error,
    hasMore,
    loadMore,
    totalCount,
    refetch,
  };
}
