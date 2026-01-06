-- Add service update policies for metrics tables to allow upsert operations

CREATE POLICY "Service can update social content" 
ON public.social_content 
FOR UPDATE 
USING (true);

CREATE POLICY "Service can update social content metrics" 
ON public.social_content_metrics 
FOR UPDATE 
USING (true);

CREATE POLICY "Service can update social account metrics" 
ON public.social_account_metrics 
FOR UPDATE 
USING (true);