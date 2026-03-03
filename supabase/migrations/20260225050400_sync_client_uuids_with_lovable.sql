-- Sync client UUIDs to match Lovable's project
-- This ensures all data imports will have matching foreign keys

-- Step 1: Clear dependent data first (only metricool configs exist at this point)
DELETE FROM public.client_metricool_config;

-- Step 2: Delete all auto-generated clients
DELETE FROM public.clients;

-- Step 3: Re-insert clients with exact UUIDs from Lovable
INSERT INTO public.clients (id, name) VALUES
  ('79099b9d-0281-4a95-8076-dcff0fd128a4', 'BlingyBag'),
  ('973e8407-bf7f-45ca-bd73-a26acc3ad9e3', 'BSUE Brow & Lash'),
  ('edfc083a-77f7-4c83-b6e0-a32bfc0553a1', 'Cissie Pryor Presents'),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'Father Figure Formula'),
  ('3177cefc-46cc-4790-8a20-65b160103077', 'Luxxe Auto Accessories'),
  ('1a1edf9f-2ebe-4d40-a904-7295d5033401', 'OxiSure Tech'),
  ('041555a7-1a25-42b8-89c7-edc40afff861', 'Serenity Scrolls'),
  ('d8f38e01-77ff-4839-ac48-54795adc9f3e', 'Sienvi Agency'),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'Snarky Humans'),
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'Snarky Pets'),
  ('b6c39651-9259-4930-af6e-b744a5a191ad', 'The Haven At Deer Park');

-- Step 4: Re-insert Metricool configs with correct client_ids
-- user_id = '4380439' for all

-- Snarky Humans (blog_id: 5691309) — IG, FB, TikTok, YouTube, Meta Ads, Google Ads
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'instagram', '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'facebook', '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'tiktok', '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'youtube', '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'meta_ads', '4380439', '5691309', true),
  ('ef580ebf-439f-4305-826a-f1f8aa89fd03', 'google_ads', '4380439', '5691309', true);

-- Snarky Pets (blog_id: 5691190)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'instagram', '4380439', '5691190', true),
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'facebook', '4380439', '5691190', true),
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'tiktok', '4380439', '5691190', true),
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'youtube', '4380439', '5691190', true),
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'meta_ads', '4380439', '5691190', true),
  ('d8a121fe-cdd9-4e19-90dc-dd32b159f973', 'google_ads', '4380439', '5691190', true);

-- Father Figure Formula (blog_id: 5691111) — includes LinkedIn
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'instagram', '4380439', '5691111', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'facebook', '4380439', '5691111', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'tiktok', '4380439', '5691111', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'linkedin', '4380439', '5691111', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'youtube', '4380439', '5691111', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'meta_ads', '4380439', '5691111', true),
  ('95791e88-87cd-4621-af7e-df46f5ad93ac', 'google_ads', '4380439', '5691111', true);

-- Sienvi Agency (blog_id: 5650673)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('d8f38e01-77ff-4839-ac48-54795adc9f3e', 'instagram', '4380439', '5650673', true),
  ('d8f38e01-77ff-4839-ac48-54795adc9f3e', 'facebook', '4380439', '5650673', true),
  ('d8f38e01-77ff-4839-ac48-54795adc9f3e', 'tiktok', '4380439', '5650673', true),
  ('d8f38e01-77ff-4839-ac48-54795adc9f3e', 'youtube', '4380439', '5650673', true);

-- Serenity Scrolls (blog_id: 4380439)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('041555a7-1a25-42b8-89c7-edc40afff861', 'instagram', '4380439', '4380439', true),
  ('041555a7-1a25-42b8-89c7-edc40afff861', 'facebook', '4380439', '4380439', true),
  ('041555a7-1a25-42b8-89c7-edc40afff861', 'tiktok', '4380439', '4380439', true),
  ('041555a7-1a25-42b8-89c7-edc40afff861', 'youtube', '4380439', '4380439', true);

-- OxiSure Tech (blog_id: 5691500)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('1a1edf9f-2ebe-4d40-a904-7295d5033401', 'instagram', '4380439', '5691500', true),
  ('1a1edf9f-2ebe-4d40-a904-7295d5033401', 'facebook', '4380439', '5691500', true),
  ('1a1edf9f-2ebe-4d40-a904-7295d5033401', 'tiktok', '4380439', '5691500', true),
  ('1a1edf9f-2ebe-4d40-a904-7295d5033401', 'youtube', '4380439', '5691500', true);

-- The Haven At Deer Park (blog_id: 5691522)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('b6c39651-9259-4930-af6e-b744a5a191ad', 'instagram', '4380439', '5691522', true),
  ('b6c39651-9259-4930-af6e-b744a5a191ad', 'facebook', '4380439', '5691522', true),
  ('b6c39651-9259-4930-af6e-b744a5a191ad', 'tiktok', '4380439', '5691522', true),
  ('b6c39651-9259-4930-af6e-b744a5a191ad', 'youtube', '4380439', '5691522', true);

-- Cissie Pryor Presents (blog_id: 5691382)
INSERT INTO public.client_metricool_config (client_id, platform, user_id, blog_id, is_active)
VALUES
  ('edfc083a-77f7-4c83-b6e0-a32bfc0553a1', 'instagram', '4380439', '5691382', true),
  ('edfc083a-77f7-4c83-b6e0-a32bfc0553a1', 'facebook', '4380439', '5691382', true),
  ('edfc083a-77f7-4c83-b6e0-a32bfc0553a1', 'youtube', '4380439', '5691382', true);

-- BlingyBag, BSUE, Luxxe — no Metricool config (Shopify-only / no blog_id)
