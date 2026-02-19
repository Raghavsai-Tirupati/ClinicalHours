// Opportunities service layer
// Centralized API calls for opportunities

import { supabase } from "@/integrations/supabase/client";
import { Opportunity, OpportunityRow } from "@/types";
import { logger } from "@/lib/logger";

export interface FetchOpportunitiesOptions {
  filterType?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  userLocation?: { lat: number; lng: number };
  sortByDistance?: boolean;
}

export interface FetchOpportunitiesResult {
  data: Opportunity[];
  count: number | null;
  error: Error | null;
}

/**
 * Fetch opportunities from the database
 */
export async function fetchOpportunities(
  options: FetchOpportunitiesOptions = {}
): Promise<FetchOpportunitiesResult> {
  try {
    const { filterType, searchTerm, limit, offset, userLocation } = options;

    // If user location provided, use RPC to get distance-sorted results
    if (userLocation) {
      return await fetchOpportunitiesWithDistance(options);
    }

    let query = supabase
      .from("opportunities_with_ratings")
      .select("*", { count: "exact" });

    // Apply type filter
    if (filterType && filterType !== "all") {
      query = query.eq("type", filterType);
    }

    // Apply search filter - use parameterized queries to prevent SQL injection
    if (searchTerm) {
      const sanitizedSearchTerm = searchTerm.trim().slice(0, 100);
      if (sanitizedSearchTerm) {
        // Escape special characters for ilike pattern and use parameterized approach
        const escapedSearch = sanitizedSearchTerm.replace(/[%_\\]/g, "\\$&");
        // Use Supabase's safe ilike method with proper escaping
        // Build search pattern safely
        const searchPattern = `%${escapedSearch}%`;
        // Use separate filters instead of string interpolation in .or()
        query = query.or(`name.ilike.${searchPattern.replace(/,/g, "\\,")},location.ilike.${searchPattern.replace(/,/g, "\\,")}`);
      }
    }

    // Sort by name when no location
    query = query.order("name", { ascending: true });

    // Apply pagination with proper defaults
    const pageLimit = limit || 20; // Default to 20 items per page
    if (offset !== undefined) {
      query = query.range(offset, offset + pageLimit - 1);
    } else {
      query = query.limit(pageLimit);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const opportunities: Opportunity[] = (data || []).map((opp: OpportunityRow) => ({
      id: opp.id,
      name: opp.name,
      type: opp.type,
      location: opp.location,
      latitude: opp.latitude,
      longitude: opp.longitude,
      hours_required: opp.hours_required,
      acceptance_likelihood: opp.acceptance_likelihood,
      description: opp.description,
      requirements: opp.requirements || [],
      phone: opp.phone,
      email: opp.email,
      website: opp.website,
      slug: opp.slug,
      hospital_id: opp.hospital_id,
      avg_rating: opp.avg_rating,
      review_count: opp.review_count,
    }));

    return {
      data: opportunities,
      count,
      error: null,
    };
  } catch (error) {
    logger.error("Error fetching opportunities", error);
    return {
      data: [],
      count: null,
      error: error as Error,
    };
  }
}

/**
 * Fetch opportunities sorted by distance using server-side calculation
 */
async function fetchOpportunitiesWithDistance(
  options: FetchOpportunitiesOptions
): Promise<FetchOpportunitiesResult> {
  try {
    const { filterType, searchTerm, limit, offset, userLocation } = options;

    if (!userLocation) {
      return fetchOpportunities({ ...options, userLocation: undefined });
    }

    const pageLimit = limit || 20;
    const pageOffset = offset || 0;

    // Use server-side distance sorting function
    const { data, error } = await supabase.rpc("get_opportunities_by_distance", {
      user_lat: userLocation.lat,
      user_lon: userLocation.lng,
      filter_type: filterType && filterType !== "all" ? filterType : null,
      search_term: searchTerm?.trim().slice(0, 100) || null,
      page_limit: pageLimit,
      page_offset: pageOffset,
    });

    if (error) throw error;

    // Get total count
    const { data: countData, error: countError } = await supabase.rpc("count_opportunities", {
      filter_type: filterType && filterType !== "all" ? filterType : null,
      search_term: searchTerm?.trim().slice(0, 100) || null,
    });

    if (countError) {
      logger.error("Error getting count", countError);
    }

    const opportunities: Opportunity[] = (data || []).map((opp: {
      id: string;
      name: string;
      type: string;
      location: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      hours_required: string;
      acceptance_likelihood: string;
      description?: string;
      requirements?: string[];
      phone?: string;
      email?: string;
      website?: string;
      slug?: string;
      hospital_id?: string;
      avg_rating?: number;
      review_count?: number;
      distance_miles?: number;
    }) => ({
      id: opp.id,
      name: opp.name,
      type: opp.type,
      location: opp.location,
      latitude: opp.latitude,
      longitude: opp.longitude,
      hours_required: opp.hours_required,
      acceptance_likelihood: opp.acceptance_likelihood,
      description: opp.description,
      requirements: opp.requirements || [],
      phone: opp.phone,
      email: opp.email,
      website: opp.website,
      slug: opp.slug,
      hospital_id: opp.hospital_id,
      avg_rating: opp.avg_rating,
      review_count: opp.review_count,
      distance: opp.distance_miles,
    }));

    return {
      data: opportunities,
      count: countData || null,
      error: null,
    };
  } catch (error) {
    logger.error("Error fetching opportunities with distance", error);
    return {
      data: [],
      count: null,
      error: error as Error,
    };
  }
}

/**
 * Fetch a single opportunity by ID
 */
export async function fetchOpportunityById(
  id: string
): Promise<{ data: Opportunity | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("opportunities_with_ratings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    const opportunity: Opportunity = {
      id: data.id,
      name: data.name,
      type: data.type,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      hours_required: data.hours_required,
      acceptance_likelihood: data.acceptance_likelihood,
      description: data.description,
      requirements: data.requirements || [],
      phone: data.phone,
      email: data.email,
      website: data.website,
      avg_rating: data.avg_rating,
      review_count: data.review_count,
    };

    return { data: opportunity, error: null };
  } catch (error) {
    logger.error("Error fetching opportunity", error);
    return { data: null, error: error as Error };
  }
}
