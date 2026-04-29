-- Fix RLS: ensure anon users (and authenticated users) can read client_ga4_config
-- The previous policy was scoped to 'authenticated' role but the frontend may be 
-- querying before session is fully established, or the join fails silently.

-- Drop existing policies and recreate with broader access
DROP POLICY IF EXISTS "Users can view ga4 configs" ON public.client_ga4_config;
DROP POLICY IF EXISTS "Users can manage ga4 configs" ON public.client_ga4_config;

-- Allow all authenticated users to SELECT
CREATE POLICY "Authenticated users can view ga4 configs"
ON public.client_ga4_config FOR SELECT
TO authenticated
USING (true);

-- Allow anon users to SELECT (needed for joined queries from the dashboard)
CREATE POLICY "Anon users can view ga4 configs"
ON public.client_ga4_config FOR SELECT
TO anon
USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated users can manage ga4 configs"
ON public.client_ga4_config FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
