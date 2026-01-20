-- Add INSERT policies for social_follower_timeline
CREATE POLICY "Service can insert timeline data"
ON public.social_follower_timeline
FOR INSERT
WITH CHECK (true);

-- Add UPDATE policy for social_follower_timeline (for upsert)
CREATE POLICY "Service can update timeline data"
ON public.social_follower_timeline
FOR UPDATE
USING (true);

-- Add INSERT policies for social_account_demographics
CREATE POLICY "Service can insert demographics"
ON public.social_account_demographics
FOR INSERT
WITH CHECK (true);

-- Add UPDATE policy for social_account_demographics (for upsert)
CREATE POLICY "Service can update demographics"
ON public.social_account_demographics
FOR UPDATE
USING (true);