-- shopify_oauth_connections: 3 rows
INSERT INTO "shopify_oauth_connections" ("access_token", "client_id", "connected_at", "id", "is_active", "scope", "shop_domain", "updated_at") VALUES
  ('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', 'ef580ebf-439f-4305-826a-f1f8aa89fd03', '2026-01-31T03:13:14.044+00:00', 'e2fa3ef2-d598-4e64-90a5-e368822fec0d', true, 'read_all_orders,read_analytics,read_customers,read_orders,read_products,read_reports', 'bedd78-a1.myshopify.com', '2026-01-31T03:13:14.044+00:00'),
  ('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', 'd8a121fe-cdd9-4e19-90dc-dd32b159f973', '2026-01-31T03:58:08.506+00:00', 'bca580f2-78a7-4a03-a813-e7a30eccea27', true, 'read_all_orders,read_analytics,read_customers,read_orders,read_products,read_reports', 'fhfwar-jc.myshopify.com', '2026-01-31T03:58:08.506+00:00'),
  ('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', '79099b9d-0281-4a95-8076-dcff0fd128a4', '2026-01-31T05:06:18.115+00:00', '5151fa09-1d53-4507-ab49-596219ff150e', true, 'read_all_orders,read_analytics,read_customers,read_orders,read_products,read_reports', '3bc448-da.myshopify.com', '2026-01-31T05:06:18.115+00:00')
ON CONFLICT (id) DO NOTHING;

