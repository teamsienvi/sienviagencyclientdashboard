-- Add a policy to allow public read access to clients for the dashboard
CREATE POLICY "Anyone can view active clients" 
ON public.clients 
FOR SELECT 
USING (is_active = true);