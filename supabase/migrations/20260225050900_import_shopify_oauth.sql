-- Import shopify_oauth_connections from Lovable
INSERT INTO public.shopify_oauth_connections (id, client_id, shop_domain, access_token, scope, is_active, connected_at, updated_at)
VALUES
  ('e2fa3ef2-d598-4e64-90a5-e368822fec0d', 'ef580ebf-439f-4305-826a-f1f8aa89fd03', 'bedd78-a1.myshopify.com', '***REDACTED***', 'read_all_orders,read_analytics,read_customers,read_orders,read_products,read_reports', true, '2026-01-31T03:13:14.044+00:00', '2026-01-31T03:13:14.044+00:00'),
  ('bca580f2-78a7-4a03-a813-e7a30eccea27', 'd8a121fe-cdd9-4e19-90dc-dd32b159f973', 'fhfwar-jc.myshopify.com', '***REDACTED***', 'read_all_orders,read_analytics,read_customers,read_orders,read_products,read_reports', true, '2026-01-31T03:58:08.506+00:00', '2026-01-31T03:58:08.506+00:00'),
  ('5151fa09-1d53-4507-ab49-596219ff150e', '79099b9d-0281-4a95-8076-dcff0fd128a4', '3bc448-da.myshopify.com', '***REDACTED***', 'read_all_orders,read_analytics,read_customers,read_orders,read_products,read_reports', true, '2026-01-31T05:06:18.115+00:00', '2026-01-31T05:06:18.115+00:00')
ON CONFLICT (id) DO NOTHING;
