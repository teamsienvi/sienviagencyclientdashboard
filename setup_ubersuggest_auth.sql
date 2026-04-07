-- Create the table for storing integration credentials (like the Ubersuggest token)
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT UNIQUE NOT NULL, -- e.g., 'ubersuggest'
    token TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated admins to see these tokens (and service_role key ignores RLS)
CREATE POLICY "Admins can view integration credentials" ON public.integration_credentials
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update integration credentials" ON public.integration_credentials
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
        )
    );
