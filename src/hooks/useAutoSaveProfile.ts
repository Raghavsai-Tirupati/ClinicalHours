import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeProfileData } from "@/lib/inputValidation";
import { logProfileUpdate } from "@/lib/auditLogger";
import { logger } from "@/lib/logger";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

interface UseAutoSaveProfileOptions {
  userId: string | undefined;
  enabled?: boolean;
  debounceMs?: number;
}

interface ProfileData {
  full_name: string;
  city: string;
  state: string;
  phone: string;
  university: string;
  major: string;
  gpa: string;
  graduation_year: string;
  clinical_hours: string;
  pre_med_track: string;
  bio: string;
  career_goals: string;
  research_experience: string;
  linkedin_url: string;
  resume_url: string;
  email_opt_in?: boolean;
  [key: string]: string | boolean | undefined;
}

/**
 * Auto-save profile data to Supabase with debouncing
 * Saves automatically after user stops typing for the specified delay
 */
export function useAutoSaveProfile(
  profile: ProfileData,
  options: UseAutoSaveProfileOptions
) {
  const { userId, enabled = true, debounceMs = 2000 } = options;
  
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>("");
  const isInitialMount = useRef(true);
  const isSavingRef = useRef(false);
  const profileRef = useRef(profile);
  const skippedWhileSavingRef = useRef(false);

  profileRef.current = profile;

  const saveToDatabase = useCallback(async (data: ProfileData) => {
    if (!userId) return;

    if (isSavingRef.current) {
      skippedWhileSavingRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setStatus("saving");

    try {
      // Sanitize all inputs before submission
      const sanitizedData = sanitizeProfileData(data);

      const { error } = await supabase
        .from("profiles")
        .update({
          id: userId,
          full_name: sanitizedData.full_name,
          city: sanitizedData.city,
          state: sanitizedData.state,
          phone: sanitizedData.phone,
          university: sanitizedData.university,
          major: sanitizedData.major,
          gpa: sanitizedData.gpa ? parseFloat(String(sanitizedData.gpa)) : null,
          graduation_year: sanitizedData.graduation_year ? parseInt(String(sanitizedData.graduation_year)) : null,
          clinical_hours: sanitizedData.clinical_hours ? parseInt(String(sanitizedData.clinical_hours)) : 0,
          pre_med_track: sanitizedData.pre_med_track,
          bio: sanitizedData.bio,
          career_goals: sanitizedData.career_goals,
          research_experience: sanitizedData.research_experience,
          linkedin_url: sanitizedData.linkedin_url,
          resume_url: sanitizedData.resume_url,
          email_opt_in: data.email_opt_in ?? false,
        })
        .eq("id", userId);

      if (error) throw error;

      // Log profile update for audit
      const updatedFields = Object.keys(sanitizedData).filter(key => sanitizedData[key] !== undefined);
      logProfileUpdate(updatedFields);

      lastSavedDataRef.current = JSON.stringify(data);
      setLastSaved(new Date());
      setStatus("saved");
      
      // Reset to idle after showing "saved" for a moment
      setTimeout(() => {
        setStatus((current) => current === "saved" ? "idle" : current);
      }, 2000);
      
    } catch (error) {
      logger.error("Auto-save error", error);
      setStatus("error");
      
      // Reset error status after a moment
      setTimeout(() => {
        setStatus("unsaved");
      }, 3000);
    } finally {
      isSavingRef.current = false;
    }

    // A debounced save may have been skipped while the previous upsert was in flight.
    if (skippedWhileSavingRef.current && userId) {
      skippedWhileSavingRef.current = false;
      const latest = profileRef.current;
      if (JSON.stringify(latest) !== lastSavedDataRef.current) {
        void saveToDatabase(latest);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;

    // Skip saving on initial mount - wait for data to load from DB
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Initialize with current data as "saved"
      lastSavedDataRef.current = JSON.stringify(profile);
      return;
    }

    const currentData = JSON.stringify(profile);
    
    // Only trigger save if data has actually changed from last saved version
    if (currentData === lastSavedDataRef.current) {
      return;
    }

    // Show unsaved status immediately when changes are detected
    setStatus("unsaved");

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save
    timeoutRef.current = setTimeout(() => {
      saveToDatabase(profile);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [profile, enabled, userId, debounceMs, saveToDatabase]);

  // Force immediate save (for manual save button)
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    await saveToDatabase(profile);
  }, [profile, saveToDatabase]);

  /**
   * Mark data as synced with the server. Pass `snapshot` after loading from DB so
   * this is not tied to a stale React closure (e.g. async load finishing before state commits).
   */
  const markAsSaved = useCallback((snapshot?: ProfileData) => {
    const source = snapshot ?? profile;
    lastSavedDataRef.current = JSON.stringify(source);
    isInitialMount.current = false;
    setStatus("idle");
  }, [profile]);

  return {
    status,
    lastSaved,
    saveNow,
    markAsSaved,
  };
}

