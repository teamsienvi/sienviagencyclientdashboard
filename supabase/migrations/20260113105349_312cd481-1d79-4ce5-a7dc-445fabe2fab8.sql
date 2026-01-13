-- Public-read analytics for active clients (fix empty dashboards in incognito / other browsers)

-- Ensure RLS is on (safe if already enabled)
ALTER TABLE public.social_account_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_performing_posts ENABLE ROW LEVEL SECURITY;

-- Social account metrics: allow anyone to read for active clients
DROP POLICY IF EXISTS "Public can view metrics for active clients" ON public.social_account_metrics;
CREATE POLICY "Public can view metrics for active clients"
ON public.social_account_metrics
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = social_account_metrics.client_id
      AND c.is_active = true
  )
);

-- Social content: allow anyone to read for active clients
DROP POLICY IF EXISTS "Public can view content for active clients" ON public.social_content;
CREATE POLICY "Public can view content for active clients"
ON public.social_content
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = social_content.client_id
      AND c.is_active = true
  )
);

-- Social content metrics: allow anyone to read for active clients (via parent content -> client)
DROP POLICY IF EXISTS "Public can view content metrics for active clients" ON public.social_content_metrics;
CREATE POLICY "Public can view content metrics for active clients"
ON public.social_content_metrics
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.social_content sc
    JOIN public.clients c ON c.id = sc.client_id
    WHERE sc.id = social_content_metrics.social_content_id
      AND c.is_active = true
  )
);

-- Top performing posts: allow anyone to read for active clients (via report -> client)
DROP POLICY IF EXISTS "Public can view top posts for active clients" ON public.top_performing_posts;
CREATE POLICY "Public can view top posts for active clients"
ON public.top_performing_posts
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.reports r
    JOIN public.clients c ON c.id = r.client_id
    WHERE r.id = top_performing_posts.report_id
      AND c.is_active = true
  )
);
