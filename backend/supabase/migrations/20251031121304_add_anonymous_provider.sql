-- =====================================================
-- Add Anonymous Authentication Provider Support
-- Created: 2025-10-31
-- Description: Enable anonymous sign-ins with proper provider tracking
-- =====================================================

-- Add 'anonymous' to the auth_provider CHECK constraint
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_auth_provider_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_auth_provider_check
CHECK (auth_provider IN ('email', 'google', 'github', 'apple', 'facebook', 'twitter', 'azure', 'anonymous', 'other'));

-- Update comment
COMMENT ON COLUMN public.user_profiles.auth_provider IS 'Authentication provider used for signup (email, google, github, apple, facebook, twitter, azure, anonymous, other)';

-- Update handle_new_user() trigger to properly detect anonymous provider
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
  -- Detect provider: check is_anonymous first, then raw_app_meta_data
  -- For anonymous users, Supabase sets is_anonymous=true but doesn't populate raw_app_meta_data->>'provider'
  IF NEW.is_anonymous = TRUE THEN
    user_provider := 'anonymous';
  ELSE
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
  END IF;

  -- Insert user profile (tier='free', is_admin=false, is_active=true)
  -- For anonymous users, generate a unique email since they have empty string in auth.users
  INSERT INTO public.user_profiles (id, email, tier, is_admin, is_active, auth_provider)
  VALUES (
    NEW.id,
    CASE
      WHEN user_provider = 'anonymous' THEN 'anonymous-' || NEW.id || '@anon.local'
      ELSE COALESCE(NULLIF(NEW.email, ''), 'user-' || NEW.id || '@unknown.local')
    END,
    'free',
    FALSE,
    TRUE,
    user_provider
  );

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
COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates user profile (with provider tracking including anonymous), quota, and welcome bonus (50k tokens) when new user signs up';

-- =====================================================
-- Migration Complete
-- =====================================================
