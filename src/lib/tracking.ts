/**
 * Event Tracking Utility
 * 
 * Tracks page views, button clicks, and conversions for analytics.
 * Uses fire-and-forget pattern to avoid blocking the UI.
 */

// Session ID storage key — separate from guest session ID to avoid overlap
const TRACKING_SESSION_KEY = "clinicalhours_tracking_session_id";
const GUEST_SESSION_KEY = "clinicalhours_guest_session_id";

// Track whether the current session has been "upgraded" to authenticated
let _cachedAuthSessionId: string | null = null;

/**
 * Get or create tracking session ID.
 * 
 * IMPORTANT: Once a user authenticates we generate a NEW session ID so that
 * the same session_id is never shared between guest (user_id=null) and
 * authenticated (user_id!=null) tracking events. This prevents guest session
 * counts from being inflated by authenticated page views.
 */
export function getTrackingSessionId(isAuthenticated = false): string {
  try {
    // If the user is authenticated, use a dedicated auth session id
    if (isAuthenticated) {
      if (_cachedAuthSessionId) return _cachedAuthSessionId;

      // Check if we already stored one
      const stored = localStorage.getItem(TRACKING_SESSION_KEY + "_auth");
      if (stored) {
        _cachedAuthSessionId = stored;
        return stored;
      }

      // Generate a fresh one (distinct from any guest session)
      const newId = generateUUID();
      localStorage.setItem(TRACKING_SESSION_KEY + "_auth", newId);
      _cachedAuthSessionId = newId;
      return newId;
    }

    // Guest / unauthenticated: use guest session ID if available
    const guestSessionId = localStorage.getItem(GUEST_SESSION_KEY);
    if (guestSessionId) return guestSessionId;

    // Fallback to generic tracking session
    let trackingSessionId = localStorage.getItem(TRACKING_SESSION_KEY);
    if (trackingSessionId) return trackingSessionId;

    trackingSessionId = generateUUID();
    localStorage.setItem(TRACKING_SESSION_KEY, trackingSessionId);
    return trackingSessionId;
  } catch {
    return generateUUID();
  }
}

/**
 * Call when a user logs out to reset the auth tracking session,
 * so the next anonymous browsing gets a fresh guest session id.
 */
export function resetAuthTrackingSession(): void {
  _cachedAuthSessionId = null;
  try {
    localStorage.removeItem(TRACKING_SESSION_KEY + "_auth");
  } catch { /* ignore */ }
}

/**
 * Get the tracking endpoint URL
 */
function getTrackingEndpoint(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/track`;
  }
  // Fallback for development
  return "/track";
}

/**
 * Get device/browser info
 */
function getDeviceInfo() {
  return {
    user_agent: navigator.userAgent,
    screen_width: window.screen?.width || window.innerWidth,
    screen_height: window.screen?.height || window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Event types
 */
export type TrackingEventType = 
  | "page_view" 
  | "button_click" 
  | "guest_conversion" 
  | "signup" 
  | "login";

export interface TrackingMetadata {
  button_name?: string;
  conversion_source?: string;
  [key: string]: unknown;
}

/**
 * Send tracking event to the backend
 * Uses fetch with keepalive for reliable tracking
 */
export async function trackEvent(
  eventType: TrackingEventType,
  metadata?: TrackingMetadata,
  userId?: string
): Promise<void> {
  const isDev = import.meta.env.DEV;
  const enableTracking = import.meta.env.VITE_ENABLE_TRACKING === "true";
  
  // In development, only track if explicitly enabled
  // In production, always track
  if (isDev && !enableTracking) {
    console.debug("[Tracking] (disabled in dev)", eventType, metadata);
    return;
  }

  const sessionId = getTrackingSessionId();
  const pageUrl = window.location.pathname + window.location.search;
  const referrerUrl = document.referrer || undefined;
  const deviceInfo = getDeviceInfo();

  const payload = {
    session_id: sessionId,
    event_type: eventType,
    page_url: pageUrl,
    referrer_url: referrerUrl,
    ...deviceInfo,
    user_id: userId,
    metadata: metadata || {},
  };

  const endpoint = getTrackingEndpoint();

  if (isDev && enableTracking) {
    console.log("[Tracking] Sending:", eventType, "to", endpoint);
  }

  try {
    // Use fetch with keepalive (works like sendBeacon but with proper headers)
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true, // Works during page unload like sendBeacon
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      if (isDev || enableTracking) {
        console.warn("[Tracking] Failed:", response.status, errorText);
      }
      return;
    }

    if (isDev && enableTracking) {
      console.log("[Tracking] Success:", eventType);
    }
  } catch (error) {
    // Log errors in development for debugging
    if (isDev || enableTracking) {
      console.error("[Tracking] Error:", error);
    }
    // Silently ignore in production - tracking should never break the app
  }
}

/**
 * Track a page view
 * Debounces rapid page views to the same URL
 */
export function trackPageView(userId?: string): void {
  const currentUrl = window.location.pathname + window.location.search;
  const now = Date.now();

  // Debounce: don't track same page view within 1 second
  if (
    lastPageView &&
    lastPageView.url === currentUrl &&
    now - lastPageView.time < PAGE_VIEW_DEBOUNCE_MS
  ) {
    return;
  }

  lastPageView = { url: currentUrl, time: now };
  trackEvent("page_view", undefined, userId);
}

/**
 * Track a button click
 */
export function trackButtonClick(buttonName: string, userId?: string): void {
  trackEvent("button_click", { button_name: buttonName }, userId);
}

/**
 * Track guest conversion (guest user signs up)
 */
export function trackGuestConversion(userId: string): void {
  trackEvent("guest_conversion", { conversion_source: "signup" }, userId);
}

/**
 * Track signup event
 */
export function trackSignup(userId: string, source?: string): void {
  trackEvent("signup", { source: source || "email" }, userId);
}

/**
 * Track login event
 */
export function trackLogin(userId: string, method?: string): void {
  trackEvent("login", { method: method || "email" }, userId);
}

/**
 * Custom hook for tracking page views on route changes
 * Import this in App.tsx and use within BrowserRouter context
 */
export function usePageViewTracking(userId?: string): void {
  // This will be called by the PageViewTracker component
  trackPageView(userId);
}
