# ClinicalHours PRD

## Product Summary
ClinicalHours helps aspiring clinical professionals discover opportunities, save and track placements, log hours, and capture reflections. The product now has three distinct paths: anonymous guest exploration, authenticated student usage, and hospital/clinical-site onboarding with admin approval.

## Business Goals
- Increase visitor-to-guest activation by letting users try the product without signup.
- Convert guests into registered users by preserving their progress and migrating local activity into an account.
- Convert free users into premium users through the direct application-link limit.
- Onboard hospitals as a separate revenue and partnership motion with approval gating.
- Give admins enough visibility to monitor conversions, guest behavior, pending approvals, and product usage.

## Primary Users
- Students and pre-health users searching for clinical opportunities.
- Guest visitors evaluating the product before creating an account.
- Hospital or clinical-site owners registering facilities and submitting applications.
- Internal admins managing users, hospitals, applications, logos, guest sessions, and activity.

## Core Flows

### Guest Discovery
- Users can enter guest mode from auth without creating an account.
- Guest sessions receive a persistent local session ID and are logged for analytics.
- Guests can browse the dashboard experience, but persistence-requiring actions should push them to sign up.
- Guest tutorial state is tracked so onboarding appears only when needed.

### Student Signup and Login
- Users can sign in with email/password or Google OAuth.
- Signup requires email, password, full name, and optional phone.
- Passwords must be at least 8 characters and include both letters and numbers.
- Student accounts receive a verification email and are routed to the post-signup flow.
- Unverified student accounts are retained only briefly and are automatically deleted after 24 hours if they are not verified.
- Existing guest activity is migrated into the new account so users do not lose progress.

### Hospital Signup and Approval
- Users can mark signup as a hospital or clinical site.
- Hospital signup collects facility name, optional website, optional address, contact name, email, phone, and description.
- Hospital accounts are created in a pending state and must be approved before access is granted.
- Approved hospital owners are routed to the hospital dashboard; unapproved users go to pending approval.
- Hospital accounts skip the student-style verification flow.

### Dashboard Tracking
- Users can save opportunities, change status, remove items, log hours, and add reflections.
- Dashboard summary cards show total hours, active opportunities, reflection count, and next deadline.
- Opportunity search works across name, location, and type.
- The direct application lookup is quota-gated for free users.

### Premium Value
- Free users can use direct application lookup only once per day.
- Premium users get unlimited direct application lookups.
- Quota resets daily and only counts successful direct-link usage.
- When quota is exhausted, the UI routes users to the purchase flow.

### Admin Oversight
- Admins have overview, student list, hospital list, pending approvals, tools, logo management, guest session analytics, and activity monitoring.
- Guest session analytics show session depth, conversion, browser/device mix, landing pages, referrers, and timeline detail.
- Pending approvals should visibly surface workload through counts and badges.

## Functional Requirements
- Guest mode must persist locally across sessions until explicitly cleared.
- Guest session IDs must be stable enough to support conversion analysis and tutorial suppression.
- Dashboard tutorials must be dismissible and persisted so users are not repeatedly interrupted.
- Guest-to-account migration must preserve local hour logs and reflections without double-counting.
- Status updates and deletes on saved opportunities should be optimistic, with error feedback on failure.
- Admin-only pages must remain inaccessible to non-admin users and unauthenticated users.
- Copy and UI states must clearly distinguish guest, student, hospital, and premium experiences.

## Business-Critical Rules
- Do not lose guest progress during signup or login; conversion friction here directly impacts activation.
- Do not show the tutorial repeatedly to returning users; repeated onboarding will reduce trust and completion.
- Automatically delete unverified student accounts after the retention window so stale signups do not accumulate.
- Only count direct-link usage against quota when a link is actually found and used.
- Make hospital signup a separate lane with approval, since it is a distinct partnership funnel.
- Keep admin guest analytics detailed enough to identify where conversion drops happen.
- Keep error states user-friendly because auth, migration, or quota failures create support burden.

## Success Metrics
- Guest mode entry rate.
- Guest-to-account conversion rate.
- Signup completion rate for students and hospitals.
- Successful guest-data migration rate.
- Free-to-premium conversion rate tied to direct-link usage.
- Opportunity saves per active user.
- Hours logged per active user.
- Reflection completion rate.
- Hospital approval throughput and time-to-approval.
- Admin visibility into guest conversion funnels and pending accounts.

## Risks and Constraints
- If guest analytics are inaccurate, conversion decisions will be distorted.
- If migration fails or duplicates data, users may lose trust and support load will rise.
- A too-restrictive quota may suppress engagement; a too-loose quota may weaken premium conversion.
- Hospital approval delays can stall a second revenue funnel.
- Overusing onboarding banners or tutorials can hurt perceived polish.

## Out of Scope
- Rebuilding the broader opportunity marketplace.
- Rewriting billing beyond the current premium gate.
- Re-architecting admin analytics beyond the new guest-session view.
- Adding new roles or complex enterprise account hierarchies.
