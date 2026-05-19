-- Table to persist weekly review checkbox state for admin users
-- Stores a JSONB blob per period so all admins share the same state

CREATE TABLE IF NOT EXISTS public.weekly_review_status (
  period_start DATE PRIMARY KEY,
  status_json  JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow all authenticated users to read and write
-- (This page is admin-only at the app level anyway)
ALTER TABLE public.weekly_review_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read review status"
  ON public.weekly_review_status FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert review status"
  ON public.weekly_review_status FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update review status"
  ON public.weekly_review_status FOR UPDATE
  USING (auth.role() = 'authenticated');
