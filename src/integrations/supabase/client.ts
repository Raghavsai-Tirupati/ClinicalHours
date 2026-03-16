import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const missingVars = [];
  if (!SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
  if (!SUPABASE_PUBLISHABLE_KEY) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  
  throw new Error(
    `Missing required Supabase environment variables: ${missingVars.join(', ')}. ` +
    `Please ensure these are set in your .env file or environment configuration.`
  );
}

// Key for storing "remember me" preference (must match useAuth.tsx)
const REMEMBER_ME_KEY = "auth_remember_me";

// Check if user wants to stay signed in
function shouldRememberUser(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(REMEMBER_ME_KEY) === "true";
  } catch {
    return false;
  }
}

// Dynamic storage adapter that uses localStorage when "remember me" is enabled,
// otherwise uses sessionStorage (cleared when tab closes)
const dynamicStorageAdapter = {
  getItem: (key: string) => {
    try {
      if (typeof window === 'undefined') return null;
      // Check both storages - localStorage first if remember me is set, then sessionStorage
      // This handles the case where user logs in without remember me, then checks it
      if (shouldRememberUser()) {
        const localValue = localStorage.getItem(key);
        if (localValue) return localValue;
      }
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window === 'undefined') return;
      if (shouldRememberUser()) {
        // Store in localStorage for persistence across browser closes
        localStorage.setItem(key, value);
        // Clean up sessionStorage if it exists
        sessionStorage.removeItem(key);
      } else {
        // Store in sessionStorage (cleared on tab close)
        sessionStorage.setItem(key, value);
        // Clean up localStorage if it exists
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore errors (e.g., quota exceeded)
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof window === 'undefined') return;
      // Remove from both storages to ensure clean logout
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  },
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Custom fetch wrapper that adds CSRF tokens and credentials
const customFetch = async (url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
  const urlString = typeof url === 'string' ? url : url.toString();
  
  const isEdgeFunction = urlString.includes('/functions/v1/');
  const isSupabaseAuth = urlString.includes('/auth/v1/');
  
  const enhancedOptions: RequestInit = {
    ...options,
  };
  
  // Only include credentials for edge functions that need cookie-based auth.
  // Most functions use JWT via Authorization header and don't need cookies.
  // Adding credentials: 'include' globally breaks CORS for functions that
  // return Access-Control-Allow-Origin: * (e.g. Lovable-managed functions).
  const COOKIE_AUTH_FUNCTIONS = ['auth-cookie'];
  const functionName = urlString.split('/functions/v1/')[1]?.split(/[?#]/)[0] || '';
  if (isEdgeFunction && !isSupabaseAuth && COOKIE_AUTH_FUNCTIONS.includes(functionName)) {
    enhancedOptions.credentials = 'include' as RequestCredentials;
  }
  
  // Add CSRF token only for cookie-auth edge functions (double-submit pattern).
  // JWT-authenticated functions don't need CSRF protection.
  const method = options.method?.toUpperCase();
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const needsCSRF = COOKIE_AUTH_FUNCTIONS.includes(functionName);
  
  if (method && stateChangingMethods.includes(method) && isEdgeFunction && needsCSRF) {
    try {
      const { getCSRFToken } = await import('@/lib/csrf');
      const csrfToken = await getCSRFToken();
      
      if (csrfToken) {
        const headers = new Headers(options.headers);
        headers.set('X-CSRF-Token', csrfToken);
        enhancedOptions.headers = headers;
      }
    } catch (error) {
      console.error('Error adding CSRF token:', error);
    }
  }
  
  return fetch(url, enhancedOptions);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: dynamicStorageAdapter, // Uses localStorage when "remember me" is enabled, sessionStorage otherwise
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Detect OAuth tokens from URL after redirect
  },
  global: {
    headers: {
      'X-Client-Info': 'clinicalhours-web',
    },
    fetch: customFetch,
  },
});