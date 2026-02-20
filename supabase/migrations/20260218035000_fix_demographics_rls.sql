-- Fix RLS policy on social_account_demographics: arguments to user_has_client_access were swapped
-- The function signature is user_has_client_access(_user_id uuid, _client_id uuid)
-- but the policy had user_has_client_access(client_id, auth.uid()) — wrong order.

DROP POLICY IF EXISTS "Users can view demographics for their clients" ON public.social_account_demographics;

CREATE POLICY "Users can view demographics for their clients"
ON public.social_account_demographics FOR SELECT
USING (public.user_has_client_access(auth.uid(), client_id));

-- Also fix the follower timeline policy which has the same bug
DROP POLICY IF EXISTS "Users can view timeline for their clients" ON public.social_follower_timeline;

CREATE POLICY "Users can view timeline for their clients"
ON public.social_follower_timeline FOR SELECT
USING (public.user_has_client_access(auth.uid(), client_id));
