# Hospital Admin Dashboard Redesign

**Date:** 2026-03-21
**Approach:** Incremental Upgrade (Option A)

## Goals

1. Redesign UI/UX to match app's dark theme, improve aesthetics and usability
2. Wire all features properly (email ready for Resend, all buttons functional)
3. Fix application detail visibility bug
4. Remove BCS-specific hardcoding — all features available to all hospital admins
5. Add missing pages: Applications hub, Interviews, Email, Activity

## Auth & Access Control

- Remove `isBcsFreeHealthClinic` name checks
- Keep `admin_email` auth model (RLS enforces server-side)
- Layout already checks `user.email === hospitalPage.admin_email`
- Future hospitals: set `admin_email` on `hospital_pages` row

## UI/UX Changes

### Sidebar
- Add nav items: Overview, Applications, Positions, Interviews, Email, Settings
- Position count badge instead of listing every position inline
- Clean, minimal, scannable

### Overview
- Stat cards: Total Applications, New, Acceptance Rate, Active Positions
- Recent Applications quick-list (last 5 across all positions)
- Positions at a Glance with status indicators

### Applications Table Refactor
- Break 661-line component into: ApplicationFilters, ApplicationTable, ApplicationDetailSheet, EmailDialog, InterviewInviteDialog
- Better detail sheet: profile card, answers, resume, GPA/hours prominent
- Admin notes on applications

## New Pages

### Applications Hub (`/applications`)
- All applications across all positions
- Position filter dropdown + existing filters
- Same detail sheet

### Interviews (`/interviews`)
- Booking URL management
- Track `interview_invited_at` on `student_applications`
- Invited/scheduled/completed states

### Email (`/email`)
- Compose to applicants by position/status
- Uses existing `send-position-interview-invites` edge function
- Templates (localStorage initially)
- Clear error handling for unverified Resend domain

### Activity (`/activity`)
- Timeline of admin actions
- New `admin_activity_log` table
- Auto-populated on status changes, emails, position updates

## Bug Fixes

- Application detail: verify `answer_options` column query, fix silent failures
- PositionQuestionsEditor: add missing move-down button
- Remove duplicate `normalizeDisplayName`
- Deduplicate `usePositions` calls with React Query
- Fix `className` spacing in HospitalOverview

## Database Changes

- Add `interview_invited_at` column to `student_applications`
- Create `admin_activity_log` table
- Migration for both
