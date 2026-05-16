-- Create table for storing client SP-API credentials securely
CREATE TABLE IF NOT EXISTS public.amazon_spapi_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    lwa_client_id TEXT NOT NULL,
    lwa_client_secret TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    aws_access_key TEXT NOT NULL,
    aws_secret_key TEXT NOT NULL,
    aws_role_arn TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id)
);

-- Enable RLS for credentials
ALTER TABLE public.amazon_spapi_credentials ENABLE ROW LEVEL SECURITY;

-- Allow service role to read/write credentials, clients can only read/write their own
CREATE POLICY "Clients can view their own amazon credentials"
    ON public.amazon_spapi_credentials
    FOR SELECT
    USING (client_id IN (
        SELECT id FROM public.clients
        WHERE auth.uid() IN (
            SELECT user_id FROM public.client_users WHERE client_id = clients.id
        ) OR EXISTS (
            SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.email LIKE '%@sienvi.com'
        )
    ));

CREATE POLICY "Admins can insert amazon credentials"
    ON public.amazon_spapi_credentials
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.email LIKE '%@sienvi.com'
        )
    );

CREATE POLICY "Admins can update amazon credentials"
    ON public.amazon_spapi_credentials
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.email LIKE '%@sienvi.com'
        )
    );

CREATE POLICY "Service role has full access to amazon credentials"
    ON public.amazon_spapi_credentials
    USING (true);


-- Create table for Amazon sales metrics
CREATE TABLE IF NOT EXISTS public.amazon_sales_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    ordered_product_sales_amount NUMERIC(10, 2) DEFAULT 0,
    ordered_product_sales_currency TEXT DEFAULT 'USD',
    units_ordered INTEGER DEFAULT 0,
    total_order_items INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, date)
);

-- Enable RLS for metrics
ALTER TABLE public.amazon_sales_metrics ENABLE ROW LEVEL SECURITY;

-- Read policy for metrics (same as credentials but just read)
CREATE POLICY "Clients can view their own amazon metrics"
    ON public.amazon_sales_metrics
    FOR SELECT
    USING (client_id IN (
        SELECT id FROM public.clients
        WHERE auth.uid() IN (
            SELECT user_id FROM public.client_users WHERE client_id = clients.id
        ) OR EXISTS (
            SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.email LIKE '%@sienvi.com'
        )
    ));

CREATE POLICY "Service role has full access to amazon metrics"
    ON public.amazon_sales_metrics
    USING (true);
