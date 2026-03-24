
-- Add status column to hospital_pages for pause/archive functionality
ALTER TABLE public.hospital_pages 
ADD COLUMN IF NOT EXISTS page_status text NOT NULL DEFAULT 'active';

-- Add comment
COMMENT ON COLUMN public.hospital_pages.page_status IS 'active, paused, or archived';
