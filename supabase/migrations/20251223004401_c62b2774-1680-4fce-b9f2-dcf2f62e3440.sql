ALTER TABLE public.social_oauth_accounts
ADD COLUMN IF NOT EXISTS user_access_token text;

COMMENT ON COLUMN public.social_oauth_accounts.user_access_token IS 'Long-lived Meta user access token used to list pages (me/accounts) and refresh page access tokens.';