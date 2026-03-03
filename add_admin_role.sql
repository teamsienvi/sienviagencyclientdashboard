-- Insert admin role for the new auth user created via Supabase Dashboard
INSERT INTO public.user_roles (id, user_id, role, created_at)
VALUES (
  gen_random_uuid(),
  '008b43f1-6748-4694-94dc-5b64e1a7268b',
  'admin',
  now()
)
ON CONFLICT DO NOTHING;
