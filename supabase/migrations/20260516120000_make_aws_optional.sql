-- Make AWS IAM fields optional to support SP-API roleless authentication
ALTER TABLE public.amazon_spapi_credentials ALTER COLUMN aws_access_key DROP NOT NULL;
ALTER TABLE public.amazon_spapi_credentials ALTER COLUMN aws_secret_key DROP NOT NULL;
ALTER TABLE public.amazon_spapi_credentials ALTER COLUMN aws_role_arn DROP NOT NULL;
