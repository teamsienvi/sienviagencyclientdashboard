-- Add SELECT policy for social_oauth_accounts so app can check connection status
CREATE POLICY "Anyone can view OAuth accounts"
ON public.social_oauth_accounts
FOR SELECT
USING (true);