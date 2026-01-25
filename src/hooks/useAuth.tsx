import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { logAuthEvent } from "@/lib/auditLogger";
import { exchangeTokenForCookie, logout as logoutCookie, restoreSessionFromCookie } from "@/lib/authCookie";

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Store CSRF token in memory (not localStorage to prevent XSS)
let csrfToken: string | null = null;

// Key for storing "remember me" preference
const REMEMBER_ME_KEY = "auth_remember_me";

// Key for storing guest mode preference
const GUEST_MODE_KEY = "clinicalhours_guest_mode";

// Key for storing guest session ID
const GUEST_SESSION_ID_KEY = "clinicalhours_guest_session_id";

// Debounce interval for activity updates (5 minutes)
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

// Track last activity update time
let lastActivityUpdate = 0;

/**
 * Generate a UUID v4 for guest session tracking
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (more secure)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get the current referrer, handling edge cases
 */
function getReferrer(): string | null {
  try {
    const referrer = document.referrer;
    // Only return external referrers (not same-origin)
    if (referrer && !referrer.includes(window.location.hostname)) {
      return referrer.substring(0, 500); // Limit length
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the current landing page path
 */
function getLandingPage(): string {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return '/';
  }
}

/**
 * Update guest session activity (debounced)
 */
async function updateGuestSessionActivity(sessionId: string): Promise<void> {
  const now = Date.now();
  // Only update if enough time has passed since last update
  if (now - lastActivityUpdate < ACTIVITY_UPDATE_INTERVAL_MS) {
    return;
  }
  lastActivityUpdate = now;

  try {
    const { error } = await supabase
      .from('guest_sessions')
      .update({
        last_activity: new Date().toISOString(),
        page_views: supabase.rpc ? undefined : 1, // Will increment via raw SQL if needed
      })
      .eq('session_id', sessionId);

    if (error) {
      // Silently fail - this is non-critical
      console.debug('Guest session activity update failed:', error.message);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Track guest-to-user conversion
 */
async function trackGuestConversion(userId: string): Promise<void> {
  const sessionId = getGuestSessionId();
  if (!sessionId) {
    return;
  }

  try {
    const { error } = await supabase
      .from('guest_sessions')
      .update({ converted_to_user_id: userId })
      .eq('session_id', sessionId)
      .is('converted_to_user_id', null); // Only update if not already converted

    if (error) {
      console.error('Failed to track guest conversion:', error.message);
    } else {
      console.log('Guest conversion tracked successfully for session:', sessionId);
    }
  } catch (err) {
    console.error('Error tracking guest conversion:', err);
  }
}

/**
 * Get the guest session ID from localStorage
 */
function getGuestSessionId(): string | null {
  try {
    return localStorage.getItem(GUEST_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Set or clear the guest session ID in localStorage
 */
function setGuestSessionId(sessionId: string | null): void {
  try {
    if (sessionId) {
      localStorage.setItem(GUEST_SESSION_ID_KEY, sessionId);
    } else {
      localStorage.removeItem(GUEST_SESSION_ID_KEY);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Check if guest mode is active
 */
export function getGuestModePreference(): boolean {
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Set guest mode preference
 */
export function setGuestModePreference(isGuest: boolean): void {
  try {
    if (isGuest) {
      localStorage.setItem(GUEST_MODE_KEY, "true");
    } else {
      localStorage.removeItem(GUEST_MODE_KEY);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Get the user's "remember me" preference
 */
export function getRememberMePreference(): boolean {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Set the user's "remember me" preference
 */
export function setRememberMePreference(remember: boolean): void {
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_ME_KEY, "true");
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
  } catch {
    // Ignore errors
  }
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isGuest, setIsGuest] = useState<boolean>(() => getGuestModePreference());
  const lastActivityRef = useRef<number>(Date.now());
  const sessionRef = useRef<Session | null>(null);
  const initializingRef = useRef(false);

  // Clear guest mode when user signs in and track conversion
  useEffect(() => {
    if (user) {
      // Track conversion before clearing the session ID
      const sessionId = getGuestSessionId();
      if (sessionId) {
        // Track the conversion asynchronously
        trackGuestConversion(user.id).finally(() => {
          // Clear guest session data after tracking
          setGuestSessionId(null);
        });
      }
      setGuestModePreference(false);
      setIsGuest(false);
    }
  }, [user]);

  // Enter guest mode - allows browsing without account
  const enterGuestMode = useCallback(async () => {
    setGuestModePreference(true);
    setIsGuest(true);

    // Log guest session to Supabase for analytics
    // Only log if we don't already have a session ID (new guest session)
    let sessionId = getGuestSessionId();
    if (!sessionId) {
      sessionId = generateUUID();
      setGuestSessionId(sessionId);

      const sessionData = {
        session_id: sessionId,
        user_agent: navigator.userAgent?.substring(0, 500) || 'unknown',
        referrer: getReferrer(),
        landing_page: getLandingPage(),
        last_activity: new Date().toISOString(),
        page_views: 1,
      };

      // Fire and forget - don't block on this
      supabase
        .from('guest_sessions')
        .insert(sessionData)
        .then(({ error }) => {
          if (error) {
            console.error('Failed to log guest session:', error.message);
            // Log more details for debugging
            if (error.code === '42501') {
              console.error('Permission denied - RLS policy may not be configured correctly');
            } else if (error.code === '23505') {
              console.error('Session ID already exists - this is expected for returning guests');
            } else {
              console.error('Error code:', error.code, 'Details:', error.details);
            }
          } else {
            console.log('Guest session logged successfully:', sessionId);
          }
        });
    } else {
      // Existing session - update activity
      updateGuestSessionActivity(sessionId);
    }
  }, []);

  // Exit guest mode
  const exitGuestMode = useCallback(() => {
    setGuestModePreference(false);
    setGuestSessionId(null);
    setIsGuest(false);
  }, []);

  // Keep session ref in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Reset activity timer on user interaction
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check for session timeout
  const checkSessionTimeout = useCallback(async () => {
    try {
      // Get current session directly instead of using closure
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > SESSION_TIMEOUT_MS && currentSession) {
        // Log auth event (fire and forget)
        void logAuthEvent("logout", { reason: "session_timeout" });
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
    } catch {
      // Ignore errors in timeout check
    }
  }, []);

  useEffect(() => {
    // Prevent double initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    let isMounted = true;
    let exchangeInProgress = false;

    // Set up activity listeners
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(event => {
      document.addEventListener(event, resetActivityTimer, true);
    });

    // Check session timeout every minute
    const interval = setInterval(() => {
      if (isMounted) {
        checkSessionTimeout();
      }
    }, 60 * 1000);

    // First, get the existing session BEFORE setting up the listener
    // This prevents race conditions where the listener fires before we've checked
    const initializeAuth = async () => {
      try {
        // Check Supabase session (from sessionStorage)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        // If no session in sessionStorage, try to restore from persistent httpOnly cookie
        // This enables "remember me" functionality across browser restarts
        if (!existingSession && getRememberMePreference()) {
          console.log("[Auth] No session in storage, attempting to restore from cookie...");
          try {
            const restored = await restoreSessionFromCookie();
            if (restored.success && restored.accessToken) {
              console.log("[Auth] Session restored from cookie, setting session...");
              // Set the session in Supabase using the restored tokens
              const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
                access_token: restored.accessToken,
                refresh_token: restored.refreshToken || "",
              });
              
              if (!setSessionError && setSessionData.session) {
                if (!isMounted) return;
                setSession(setSessionData.session);
                setUser(setSessionData.session.user ?? null);
                lastActivityRef.current = Date.now();
                
                // Re-exchange tokens to update cookies (with new refresh token)
                if (!exchangeInProgress) {
                  exchangeInProgress = true;
                  try {
                    const result = await exchangeTokenForCookie(
                      setSessionData.session.access_token,
                      setSessionData.session.refresh_token,
                      true // rememberMe was true since we're restoring
                    );
                    if (result.success && result.csrfToken) {
                      csrfToken = result.csrfToken;
                    }
                  } catch {
                    // Ignore token exchange errors during restore
                  } finally {
                    exchangeInProgress = false;
                  }
                }
                
                // Successfully restored - skip the normal flow
                if (isMounted) {
                  setLoading(false);
                  setIsReady(true);
                }
                return;
              }
            }
          } catch (error) {
            console.log("[Auth] Could not restore session from cookie:", error);
            // Continue with normal flow - user will need to log in
          }
        }
        
        // Set initial state
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        
        if (existingSession?.access_token && !exchangeInProgress) {
          exchangeInProgress = true;
          try {
            // Exchange token for httpOnly cookies and get CSRF token
            const rememberMe = getRememberMePreference();
            const result = await exchangeTokenForCookie(
              existingSession.access_token,
              existingSession.refresh_token,
              rememberMe
            );
            if (result.success && result.csrfToken) {
              csrfToken = result.csrfToken;
            } else {
              // If exchange failed, try to get CSRF token from cookie
              try {
                const { getCSRFToken } = await import("@/lib/csrf");
                const token = await getCSRFToken();
                if (token) {
                  csrfToken = token;
                }
              } catch {
                // Ignore CSRF token fetch errors
              }
            }
          } catch (error) {
            console.error("Error exchanging existing token for cookie:", error);
            // Try to get CSRF token anyway
            try {
              const { getCSRFToken } = await import("@/lib/csrf");
              const token = await getCSRFToken();
              if (token) {
                csrfToken = token;
              }
            } catch {
              // Ignore CSRF token fetch errors
            }
          } finally {
            exchangeInProgress = false;
          }
          lastActivityRef.current = Date.now();
        } else if (existingSession) {
          lastActivityRef.current = Date.now();
          // Try to get CSRF token even without access token
          try {
            const { getCSRFToken } = await import("@/lib/csrf");
            const token = await getCSRFToken();
            if (token) {
              csrfToken = token;
            }
          } catch {
            // Ignore CSRF token fetch errors
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsReady(true);
        }
      }
    };

    // Initialize first
    initializeAuth();

    // Then set up the listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        
        // Use setTimeout to avoid potential deadlocks
        setTimeout(() => {
          if (!isMounted) return;
          
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          setIsReady(true);
          
          if (event === "SIGNED_OUT") {
            // Clear cookies via logout endpoint
            logoutCookie().catch(console.error);
            csrfToken = null;
            // Log auth event (fire and forget)
            void logAuthEvent("logout");
            lastActivityRef.current = Date.now();
          } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            // Exchange token for httpOnly cookie (prevent multiple simultaneous exchanges)
            if (newSession?.access_token && !exchangeInProgress) {
              exchangeInProgress = true;
              const rememberMe = getRememberMePreference();
              exchangeTokenForCookie(
                newSession.access_token,
                newSession.refresh_token,
                rememberMe
              )
                .then((result) => {
                  if (result.success && result.csrfToken) {
                    csrfToken = result.csrfToken;
                  } else {
                    console.error("Failed to exchange token for cookie:", result.error);
                  }
                })
                .catch((error) => {
                  console.error("Error exchanging token for cookie:", error);
                })
                .finally(() => {
                  exchangeInProgress = false;
                });
            }
            lastActivityRef.current = Date.now();
          }
        }, 0);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, resetActivityTimer, true);
      });
      initializingRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const signOut = async () => {
    // Log auth event (fire and forget)
    void logAuthEvent("logout");
    // Clear "remember me" preference on explicit logout
    setRememberMePreference(false);
    // Clear guest mode on logout
    setGuestModePreference(false);
    setIsGuest(false);
    // Clear cookies first
    await logoutCookie();
    csrfToken = null;
    // Then sign out from Supabase
    await supabase.auth.signOut();
  };

  return { user, session, loading, isReady, signOut, isGuest, enterGuestMode, exitGuestMode };
};

// Export function to get CSRF token (for use in API requests)
export function getCSRFToken(): string | null {
  return csrfToken;
}
