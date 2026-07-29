-- =====================================================
-- Add Auth Provider Tracking
-- Created: 2025-10-25
-- Description: Track which authentication provider users signed up with
-- =====================================================

-- Add auth_provider column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'github', 'apple', 'facebook', 'twitter', 'azure', 'other'));

-- Add index for querying by provider
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_provider ON public.user_profiles(auth_provider);

-- Add comment
COMMENT ON COLUMN public.user_profiles.auth_provider IS 'Authentication provider used for signup (email, google, github, etc.)';

-- Update handle_new_user() trigger to detect and store provider
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  welcome_bonus_tokens BIGINT := 50000; -- 50k tokens welcome bonus
  user_provider TEXT;
BEGIN
  -- Detect provider from raw_app_meta_data
  -- Supabase stores provider info in raw_app_meta_data->>'provider'
  user_provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'email'
  );

  -- Normalize provider name
  user_provider := CASE
    WHEN user_provider IN ('google', 'github', 'apple', 'facebook', 'twitter', 'azure') THEN user_provider
    WHEN user_provider = 'email' THEN 'email'
    ELSE 'other'
  END;

  -- Insert user profile (tier='free', is_admin=false, is_active=true)
  INSERT INTO public.user_profiles (id, email, tier, is_admin, is_active, auth_provider)
  VALUES (NEW.id, NEW.email, 'free', FALSE, TRUE, user_provider);

  -- Insert user quota with welcome bonus tokens
  INSERT INTO public.user_quotas (user_id, tokens_available, tokens_used)
  VALUES (NEW.id, welcome_bonus_tokens, 0);

  -- Record the welcome bonus transaction
  INSERT INTO public.token_purchases (user_id, tokens_added, purchase_type, description)
  VALUES (NEW.id, welcome_bonus_tokens, 'registration', 'Welcome bonus for new user registration');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user trigger for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Update comment
COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates user profile (with provider tracking), quota, and welcome bonus (50k tokens) when new user signs up';

-- =====================================================
-- Migration Complete
-- =====================================================
