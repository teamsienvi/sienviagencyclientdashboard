-- Clean up the manually inserted auth user that's causing GoTrue errors
-- Run this in the NEW Supabase project SQL Editor

-- Delete the identity first (foreign key constraint)
DELETE FROM auth.identities 
WHERE user_id = '49703cde-8442-4a0a-8b0b-aeb6391e429d';

-- Delete the user
DELETE FROM auth.users 
WHERE id = '49703cde-8442-4a0a-8b0b-aeb6391e429d';

-- Also delete the user_roles entry (we'll recreate it with the new UUID)
DELETE FROM public.user_roles 
WHERE user_id = '49703cde-8442-4a0a-8b0b-aeb6391e429d';
