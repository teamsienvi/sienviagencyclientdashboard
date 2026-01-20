-- Add DELETE policies for social_follower_timeline
CREATE POLICY "Service can delete timeline data"
ON public.social_follower_timeline
FOR DELETE
USING (true);

-- Add DELETE policies for social_account_demographics
CREATE POLICY "Service can delete demographics"
ON public.social_account_demographics
FOR DELETE
USING (true);