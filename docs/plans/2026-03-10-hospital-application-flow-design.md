# Hospital Application Flow – Design

**Date:** 2026-03-10  
**Status:** Approved

## Goal

Connect hospital admin and student application directly: one Apply button on the opportunities page that uses the hospital’s form (custom questions), submits to `hospital_applications`, and links both the opportunity and hospital account. The hospital sees all responses in the third tab (Student Applications).

## Architecture

- **Data:** One submission stored in `hospital_applications` with `account_id` and `opportunity_id`; custom answers in `hospital_application_answers`.
- **Flow:** Student clicks Apply on opportunity page → application form uses `hospital_application_questions` → submits to `hospital_applications` + `hospital_application_answers`.
- **Display:** Tab 3 shows `hospital_applications` for the hospital’s account(s) with opportunity context.

## Section 1: Data Model

- Add `opportunity_id` (nullable UUID, FK to `opportunities`) on `hospital_applications`.
- Submissions are linked to both `account_id` and `opportunity_id`.
- Custom answers remain in `hospital_application_answers` (unchanged).
- Legacy `applications` table is unchanged for now; can be merged later if desired.

## Section 2: UI Flow

**Student path**

1. Student is on `/opportunities` or `/opportunities/:slug`.
2. One **Apply** button on the opportunity card/detail page.
3. Clicking Apply goes to the application form. Route: `/opportunities/:slug/apply` (opportunity-centric, resolves hospital account from `opportunity.hospital_id`).
4. Form uses `hospital_application_questions` for that account; if none exist, shows base fields (name, email, phone, resume).
5. On submit: insert `hospital_applications` with `account_id`, `opportunity_id`, and `hospital_application_answers`.

**Hospital dashboard – Tab 3 (Student Applications)**

- Lists submissions from `hospital_applications` where `account_id` is in the hospital’s accounts.
- Columns: Student name, email, opportunity (position), date, status.
- View opens a detail view with full submission and answers.
- Status actions (New → Under Review → Accepted/Rejected) supported.

## Section 3: RLS & Security

- Hospital members can SELECT and UPDATE `hospital_applications` where `account_id` is in their hospital’s accounts (via `hospital_accounts`).
- Students can INSERT into `hospital_applications` and `hospital_application_answers` (auth + guest via existing `submit_guest_hospital_application`).
- Existing RLS for `hospital_application_questions` and `hospital_application_answers` remains.

## Edge Cases

- **Opportunity without hospital account:** Show message “Apply not available for this opportunity” or fall back to legacy `/opportunities/:slug/application` if we keep it.
- **Guest applicants:** Use existing `submit_guest_hospital_application`; extend to accept `opportunity_id`.
