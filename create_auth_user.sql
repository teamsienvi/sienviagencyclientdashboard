-- Create admin auth user in new Supabase project
-- This user matches the user_roles entry imported earlier
-- Email: teamsienvi@gmail.com | Password: admin123

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '49703cde-8442-4a0a-8b0b-aeb6391e429d',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'teamsienvi@gmail.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Also create the identity record so email login works
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '49703cde-8442-4a0a-8b0b-aeb6391e429d',
  'teamsienvi@gmail.com',
  'email',
  '{"sub": "49703cde-8442-4a0a-8b0b-aeb6391e429d", "email": "teamsienvi@gmail.com", "email_verified": true, "phone_verified": false}'::jsonb,
  now(),
  now(),
  now()
)
ON CONFLICT DO NOTHING;
