# Cloud paused: restore backend access

## What's happening
The Cloud panel shows "You've run out of credits" and "Cloud project paused." This is a workspace billing state, not a code or configuration problem. While paused, the database, auth, storage, and edge functions are unreachable, so the Cloud sub-tabs (Overview, Database, Users, Edge functions, SQL editor, Logs) will not load.

Nothing is deleted while paused. Data, functions, and secrets stay intact and come back as soon as the backend resumes.

## How to fix it
1. A workspace owner or admin adds credits: the **Top up** button in the paused panel, or Workspace Settings -> Plans & credit usage.
2. Cloud resumes automatically once credits land. If it stays paused after a few minutes, I can check the backend lifecycle state and request a resume.

If you are not the owner/admin, send them this: "Clinical Compass's Lovable Cloud backend is paused because the workspace is out of credits. The live site's logins, applications, and analytics are down until credits are topped up."

## What is broken on clinicalhours.org while paused
Anything that calls the backend fails, notably:
- Student and clinic sign-in / sign-up
- Opportunity search, saved opportunities, tracker, experiences
- Application submission (`submit-position-application`) and hospital portal
- Admin dashboard and student analytics
- Scheduled email reminders and the `student-analytics` / `mcp-server` endpoints used by Azure

Static marketing pages keep rendering, but every data-backed view will show empty states or errors.

## After credits are restored
Once you confirm the top-up, I will:
1. Verify the backend reports healthy.
2. Smoke-test the critical paths: a signed-in read, an application submit preflight, and the analytics endpoint.
3. Report anything that did not come back cleanly.

No code changes are part of this plan.
