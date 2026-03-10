# Premium Paywall Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up real premium status from Supabase so features are gated behind a paywall, with a `subscriptions` table ready for Stripe integration.

**Architecture:** A `subscriptions` table stores subscription records (Stripe-ready). A database trigger syncs `profiles.is_premium` and `profiles.premium_expires_at` whenever subscriptions change. The `usePremiumStatus` hook queries `profiles.is_premium` from Supabase. Two accounts are seeded as premium.

**Tech Stack:** Supabase (PostgreSQL, RLS), React, TypeScript, TanStack React Query

---

## Task 1: SQL Migration — subscriptions table + trigger + seed

**Files:**
- Create: `supabase/migrations/20260310000000_subscriptions_table.sql`

Creates the `subscriptions` table, RLS policies, a trigger to sync `profiles.is_premium`, and seeds two premium accounts.

## Task 2: Update TypeScript types

**Files:**
- Modify: `src/integrations/supabase/types.ts`

Add `subscriptions` table types and `is_premium`/`premium_expires_at` to profiles type.

## Task 3: Rewrite usePremiumStatus hook

**Files:**
- Modify: `src/hooks/usePremiumStatus.ts`

Replace local-state-only logic with a Supabase query for `profiles.is_premium`. Use React Query for caching.

## Task 4: Update Premium.tsx upgrade buttons

**Files:**
- Modify: `src/pages/Premium.tsx`

Replace `activatePremium()` calls with a "Coming soon" toast. Remove deactivate testing UI.

## Task 5: Verify

Lint check on all modified files.
