# Auth Error Messaging & UX Improvements

**Date**: 2026-03-10
**Status**: Approved

## Problem

1. Login form validates password *strength* (8+ chars, letters+numbers) before even attempting authentication. Users trying to log in with an unknown email see password requirement errors instead of credential errors.
2. Signup with an existing email shows "Unable to create account" with no hint that the email is already registered.
3. Error messages are generic and offer no recovery paths (sign up, reset password, etc.).
4. Password requirement text says "digits" when it means "characters."

## Root Cause (Signup Bug)

The signup error handler masks Supabase's "User already registered" error behind a generic message to prevent email enumeration. For a student-facing clinical hours app, this security measure causes more confusion than it prevents. Users who signed up via Google OAuth and then try email signup see an unhelpful error.

## Approach: User-Friendly with Recovery Paths

### Changes

1. **Split Zod schemas** — `loginSchema` validates email format only; `signupSchema` validates email + password strength + name
2. **Login errors** — show "Incorrect email or password" with recovery guidance (forgot password link)
3. **Signup "already registered"** — detect and show "An account with this email already exists. Try signing in or resetting your password."
4. **Inline password requirements** — show requirements below password field during signup, updating in real-time
5. **Fix wording** — "characters" not "digits"
6. **Log raw errors** — always console.error the actual Supabase error for debugging

### Security Decision

Revealing email existence is acceptable for this app context. Gmail, GitHub, Notion, and most SaaS products do the same. The UX benefit outweighs the minimal email enumeration risk for a clinical education platform.

## Files Changed

- `src/pages/Auth.tsx` — all error handling and validation logic
