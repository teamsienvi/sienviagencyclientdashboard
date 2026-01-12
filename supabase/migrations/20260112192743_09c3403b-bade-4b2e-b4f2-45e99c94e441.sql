-- Create client_users junction table for client-based access control
CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, client_id)
);

-- Enable RLS
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has access to a client
CREATE OR REPLACE FUNCTION public.user_has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE user_id = _user_id AND client_id = _client_id
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- RLS policies for client_users
CREATE POLICY "Admins can manage client_users"
ON public.client_users FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own client mappings"
ON public.client_users FOR SELECT
USING (user_id = auth.uid());

-- Update social_account_metrics to use client access check (drop old, add new)
DROP POLICY IF EXISTS "Anyone can view social account metrics" ON public.social_account_metrics;
CREATE POLICY "Users can view their client metrics"
ON public.social_account_metrics FOR SELECT
USING (
  public.user_has_client_access(auth.uid(), client_id)
);

-- Update social_content to use client access check
DROP POLICY IF EXISTS "Anyone can view social content" ON public.social_content;
CREATE POLICY "Users can view their client content"
ON public.social_content FOR SELECT
USING (
  public.user_has_client_access(auth.uid(), client_id)
);

-- Update social_content_metrics to use client access (via social_content)
DROP POLICY IF EXISTS "Anyone can view social content metrics" ON public.social_content_metrics;
CREATE POLICY "Users can view their client content metrics"
ON public.social_content_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.social_content sc
    WHERE sc.id = social_content_id
    AND public.user_has_client_access(auth.uid(), sc.client_id)
  )
);

-- Update clients table to allow users to see their assigned clients
CREATE POLICY "Users can view their assigned clients"
ON public.clients FOR SELECT
USING (
  public.user_has_client_access(auth.uid(), id)
);