// Input validation and sanitization utilities

/**
 * Maximum length constants for input fields
 */
export const MAX_LENGTHS = {
  FULL_NAME: 100,
  CITY: 100,
  STATE: 50,
  UNIVERSITY: 200,
  MAJOR: 100,
  PRE_MED_TRACK: 100,
  BIO: 2000,
  CAREER_GOALS: 2000,
  RESEARCH_EXPERIENCE: 2000,
  PHONE: 20,
  LINKEDIN_URL: 500,
  CONTACT_NAME: 100,
  CONTACT_EMAIL: 255,
  CONTACT_SUBJECT: 200,
  CONTACT_MESSAGE: 5000,
  QUESTION_TITLE: 200,
  QUESTION_BODY: 5000,
  ANSWER_BODY: 5000,
  REVIEW_COMMENT: 2000,
} as const;

/**
 * Validates email format and length
 * Uses same basic regex as backend functions and enforces max length
 */
export function validateEmail(email: string | null | undefined): { valid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Email is required" };
  }

  if (trimmed.length > MAX_LENGTHS.CONTACT_EMAIL) {
    return {
      valid: false,
      error: `Email must be ${MAX_LENGTHS.CONTACT_EMAIL} characters or less`,
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Invalid email address" };
  }

  return { valid: true };
}

/**
 * Sanitizes text input by trimming whitespace and removing dangerous patterns
 */
export function sanitizeTextInput(input: string | null | undefined): string {
  if (!input) return "";
  let sanitized = input.trim();
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");
  
  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.slice(0, 10000);
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes text input with length limits
 */
export function validateTextInput(
  input: string | null | undefined,
  maxLength: number,
  fieldName: string
): { valid: boolean; error?: string; sanitized?: string } {
  if (!input) return { valid: true, sanitized: "" };
  
  const sanitized = sanitizeTextInput(input);
  
  if (sanitized.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${maxLength} characters or less`,
      sanitized: sanitized.slice(0, maxLength),
    };
  }
  
  return { valid: true, sanitized };
}

/**
 * Checks for potentially malicious patterns (XSS, SQL injection attempts)
 */
export function containsMaliciousPattern(input: string): boolean {
  if (!input) return false;
  
  const maliciousPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick=, onerror=, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /expression\s*\(/gi, // CSS expression
    /vbscript:/gi,
    /data:text\/html/gi,
    /union\s+select/gi, // SQL injection
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
    /update\s+.*\s+set/gi,
    /exec\s*\(/gi,
    /<svg\s+onload/gi,
  ];
  
  return maliciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Normalizes phone number to consistent format
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  return phone.trim();
}

/**
 * Validates phone number format (US format) and normalizes it
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string; normalized?: string } {
  if (!phone || phone.trim() === "") return { valid: true, normalized: "" }; // Optional field
  
  // Check for malicious patterns
  if (containsMaliciousPattern(phone)) {
    return { valid: false, error: "Invalid characters in phone number" };
  }
  
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, "");
  
  // US phone numbers: 10 digits (or 11 with country code starting with 1)
  if (digitsOnly.length === 10) {
    return { valid: true, normalized: normalizePhoneNumber(phone) };
  }
  
  if (digitsOnly.length === 11 && digitsOnly[0] === "1") {
    // Remove leading 1 and normalize
    const tenDigits = digitsOnly.slice(1);
    return { valid: true, normalized: normalizePhoneNumber(tenDigits) };
  }
  
  return { 
    valid: false, 
    error: "Please enter a valid phone number (10 digits)" 
  };
}

/**
 * Validates GPA range (0-4.0)
 */
export function validateGPA(gpa: string | null | undefined): { valid: boolean; error?: string } {
  if (!gpa || gpa.trim() === "") return { valid: true }; // Optional field
  
  const numGPA = parseFloat(gpa);
  
  if (isNaN(numGPA)) {
    return { valid: false, error: "GPA must be a number" };
  }
  
  if (numGPA < 0 || numGPA > 4.0) {
    return { valid: false, error: "GPA must be between 0 and 4.0" };
  }
  
  return { valid: true };
}

/**
 * Validates graduation year
 */
export function validateGraduationYear(year: string | null | undefined): { valid: boolean; error?: string } {
  if (!year || year.trim() === "") return { valid: false, error: "Graduation year is required" };
  
  const numYear = parseInt(year);
  const currentYear = new Date().getFullYear();
  
  if (isNaN(numYear)) {
    return { valid: false, error: "Graduation year must be a number" };
  }
  
  if (numYear < 1900 || numYear > currentYear + 10) {
    return { valid: false, error: `Graduation year must be between 1900 and ${currentYear + 10}` };
  }
  
  return { valid: true };
}

/**
 * Validates URL format
 */
export function validateURL(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url || url.trim() === "") return { valid: true }; // Optional field
  
  try {
    const urlObj = new URL(url);
    // Check if it's a valid HTTP/HTTPS URL
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { valid: false, error: "URL must start with http:// or https://" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Please enter a valid URL" };
  }
}

/**
 * Validates LinkedIn URL specifically
 */
export function validateLinkedInURL(url: string | null | undefined): { valid: boolean; error?: string } {
  if (!url || url.trim() === "") return { valid: true }; // Optional field
  
  const urlValidation = validateURL(url);
  if (!urlValidation.valid) {
    return urlValidation;
  }
  
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes("linkedin.com")) {
      return { valid: false, error: "Please enter a valid LinkedIn URL" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Please enter a valid LinkedIn URL" };
  }
}

/**
 * Validates password strength
 * Requirements: letters and numbers (both required) and at least 8 characters
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: "Password needs at least 8 characters with both letters and numbers." };
  }

  // Minimum length: 8 characters
  if (password.length < 8) {
    return { valid: false, error: "Password needs at least 8 characters with both letters and numbers." };
  }

  // Maximum length: 128 characters
  if (password.length > 128) {
    return { valid: false, error: "Password needs at least 8 characters with both letters and numbers." };
  }

  // Check for letters
  const hasLetter = /[a-zA-Z]/.test(password);
  // Check for numbers
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return { valid: false, error: "Password needs at least 8 characters with both letters and numbers." };
  }

  return { valid: true };
}

/**
 * Sanitizes all profile fields before submission with XSS prevention
 */
export function sanitizeProfileData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  // Text fields with length limits and XSS prevention
  const textFieldLimits: Record<string, number> = {
    full_name: MAX_LENGTHS.FULL_NAME,
    city: MAX_LENGTHS.CITY,
    state: MAX_LENGTHS.STATE,
    university: MAX_LENGTHS.UNIVERSITY,
    major: MAX_LENGTHS.MAJOR,
    pre_med_track: MAX_LENGTHS.PRE_MED_TRACK,
    bio: MAX_LENGTHS.BIO,
    career_goals: MAX_LENGTHS.CAREER_GOALS,
    research_experience: MAX_LENGTHS.RESEARCH_EXPERIENCE,
  };
  
  Object.entries(textFieldLimits).forEach(([field, maxLength]) => {
    if (data[field] !== undefined) {
      const value = String(data[field] || "");
      // Check for malicious patterns
      if (containsMaliciousPattern(value)) {
        // Remove malicious content but keep the field
        sanitized[field] = sanitizeTextInput(value).slice(0, maxLength);
      } else {
        sanitized[field] = sanitizeTextInput(value).slice(0, maxLength);
      }
    }
  });
  
  // Phone - normalize and validate
  if (data.phone !== undefined) {
    const phoneValidation = validatePhoneNumber(String(data.phone ?? ""));
    sanitized.phone = phoneValidation.normalized || sanitizeTextInput(String(data.phone ?? ""));
  }
  
  // URL fields - validate and sanitize
  if (data.linkedin_url !== undefined) {
    const url = sanitizeTextInput(String(data.linkedin_url ?? ""));
    if (url && containsMaliciousPattern(url)) {
      sanitized.linkedin_url = ""; // Clear malicious URLs
    } else {
      sanitized.linkedin_url = url.slice(0, MAX_LENGTHS.LINKEDIN_URL);
    }
  }
  
  // Numeric fields - validate and keep as is
  if (data.gpa !== undefined) {
    const gpa = parseFloat(String(data.gpa));
    sanitized.gpa = isNaN(gpa) ? null : Math.max(0, Math.min(4.0, gpa));
  }
  if (data.graduation_year !== undefined) {
    const year = parseInt(String(data.graduation_year));
    const currentYear = new Date().getFullYear();
    sanitized.graduation_year = isNaN(year) ? null : Math.max(1900, Math.min(currentYear + 10, year));
  }
  if (data.clinical_hours !== undefined) {
    const hours = parseInt(String(data.clinical_hours));
    sanitized.clinical_hours = isNaN(hours) ? 0 : Math.max(0, hours);
  }
  
  // Keep other fields as is (but sanitize if strings)
  Object.keys(data).forEach(key => {
    if (!sanitized.hasOwnProperty(key)) {
      if (typeof data[key] === "string") {
        sanitized[key] = sanitizeTextInput(data[key]);
      } else {
        sanitized[key] = data[key];
      }
    }
  });
  
  return sanitized;
}

