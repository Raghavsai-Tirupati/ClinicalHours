-- Create tracking_events table for analytics
-- This table stores page views and user interaction events

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  page_url TEXT NOT NULL,
  referrer_url TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  timezone TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- No direct access from client - all inserts go through the track edge function
-- which uses the service role key

-- Allow admins to read tracking events for analytics
CREATE POLICY "Admins can read tracking events"
ON public.tracking_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tracking_events_session_id ON public.tracking_events(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user_id ON public.tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_type ON public.tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created_at ON public.tracking_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_events_page_url ON public.tracking_events(page_url);

-- Composite index for analytics queries (event type + date range)
CREATE INDEX IF NOT EXISTS idx_tracking_events_type_date ON public.tracking_events(event_type, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE public.tracking_events IS 'Stores page views and user interaction events for analytics';
COMMENT ON COLUMN public.tracking_events.session_id IS 'Anonymous session identifier (UUID format)';
COMMENT ON COLUMN public.tracking_events.user_id IS 'Authenticated user ID if logged in, null for guests';
COMMENT ON COLUMN public.tracking_events.event_type IS 'Type of event: page_view, button_click, guest_conversion, signup, login';
COMMENT ON COLUMN public.tracking_events.page_url IS 'URL of the page where the event occurred';
COMMENT ON COLUMN public.tracking_events.metadata IS 'Additional event-specific data in JSON format';
