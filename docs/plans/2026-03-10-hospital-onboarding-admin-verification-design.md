# Hospital Onboarding → Admin Approval Flow

**Date:** 2026-03-10

## Problem

When a new hospital signs up via Auth, the current flow creates `hospitals` + `hospital_accounts` (with only `hospital_id`) + `hospital_members`. The `hospital_accounts` table has no `account_status`, `contact_email`, or `hospital_name`. The Admin Pending Approvals tab and redirect logic expect a verification schema (`user_id`, `account_status`, etc.) that was designed in 20260223 but never applied (that migration would conflict with the ecosystem schema).

**Result:** New hospital signups never show up in the admin pending queue, and redirect/useHospitalAccount fail because they query `user_id` which doesn't exist on `hospital_accounts`.

## Solution

Extend the existing `hospital_accounts` schema with verification columns so:

1. New hospital signups create a **pending** record visible to admins
2. Admins can approve/reject; hospital-review edge function works
3. Redirect and useHospitalAccount resolve status via `hospital_members` join (user → account)

## Schema Changes

Add to `hospital_accounts`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| account_status | text | 'approved' | pending | approved | rejected |
| contact_email | text | null | Submitting user's email |
| contact_phone | text | null | Optional |
| description | text | null | Optional hospital description |
| admin_note | text | null | Admin rejection note |
| reviewed_at | timestamptz | null | When reviewed |
| reviewed_by | uuid | null | Admin user id |

- **Existing rows:** Backfill `account_status = 'approved'` so current hospitals stay live.
- **New signups:** Set `account_status = 'pending'`, `contact_email`, `contact_phone`, `description`.

`hospital_name`, `website`, `address` come from the `hospitals` join (no denormalization).

## Data Flow

### 1. Hospital signup (Auth.tsx)

- Create `hospitals` (name, address, website)
- Create `hospital_accounts` (hospital_id, **account_status='pending'**, **contact_email**, contact_phone, description)
- Create `hospital_members` (account_id, user_id, role='owner')

### 2. Admin Pending Tab

- Query `hospital_accounts` where `account_status = 'pending'`
- Join `hospitals` for `name`, `website`, `address`
- Display and approve/reject via `hospital-review`

### 3. Redirect / useHospitalAccount

- Resolve via `hospital_members`: user_id → account_id (role='owner')
- Fetch `hospital_accounts` + `hospitals` for those accounts
- If any account has status `approved` → `/hospital-dashboard`
- If any has `pending` or `rejected` → `/pending-approval`

### 4. hospital-review edge function

- Fetch `hospital_accounts` by id, join `hospitals` for name
- Update `account_status`, `reviewed_at`, `reviewed_by`, `admin_note`
- Send email using `contact_email` and hospital name
