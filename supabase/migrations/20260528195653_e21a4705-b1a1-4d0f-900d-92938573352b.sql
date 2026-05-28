
-- 1. Funnel landing step (page_view on '/')
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_page_created
ON tracking_events(event_type, page_url, created_at DESC);

-- 2. Distinct user counts (Active Users 30d)
CREATE INDEX IF NOT EXISTS idx_tracking_events_user_created
ON tracking_events(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- 3. Funnel search events
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_created
ON tracking_events(event_type, created_at DESC);

-- 4. High-intent abandoner detection
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_applied
ON saved_opportunities(user_id, applied);
