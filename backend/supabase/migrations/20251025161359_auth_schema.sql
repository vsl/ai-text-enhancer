-- =====================================================
-- Authentication & Authorization Schema Migration
-- Created: 2025-10-25
-- Description: User profiles, quota management, and token purchases
-- =====================================================

-- =====================================================
-- PART 1: Tables
-- =====================================================

-- -----------------------------------------------------
-- Table: user_profiles
-- Purpose: Stores user profile information and tier
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'plus', 'premium')),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON public.user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON public.user_profiles(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON public.user_profiles(is_active) WHERE is_active = TRUE;

-- Add comment
COMMENT ON TABLE public.user_profiles IS 'User profile information including tier, admin status, and account status';

-- -----------------------------------------------------
-- Table: user_quotas
-- Purpose: Token-based quota tracking (wallet/credits model)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tokens_available BIGINT NOT NULL DEFAULT 0 CHECK (tokens_available >= 0),
  tokens_used BIGINT NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON public.user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_tokens_available ON public.user_quotas(tokens_available);

-- Add comment
COMMENT ON TABLE public.user_quotas IS 'Token-based quota tracking for users (wallet/credits model, not daily limits)';
COMMENT ON COLUMN public.user_quotas.tokens_available IS 'Current available token balance';
COMMENT ON COLUMN public.user_quotas.tokens_used IS 'Total tokens used (historical counter)';

-- -----------------------------------------------------
-- Table: token_purchases
-- Purpose: Transaction history for token additions
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tokens_added BIGINT NOT NULL CHECK (tokens_added > 0),
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('registration', 'purchase', 'admin_grant', 'bonus')),
  amount_paid DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for queries
CREATE INDEX IF NOT EXISTS idx_token_purchases_user_id ON public.token_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_token_purchases_purchase_type ON public.token_purchases(purchase_type);
CREATE INDEX IF NOT EXISTS idx_token_purchases_created_at ON public.token_purchases(created_at DESC);

-- Add comment
COMMENT ON TABLE public.token_purchases IS 'Transaction history for token additions (purchases, grants, bonuses)';
COMMENT ON COLUMN public.token_purchases.purchase_type IS 'Type: registration (welcome bonus), purchase (paid), admin_grant (manual), bonus (promotional)';

-- =====================================================
-- PART 2: Trigger Functions
-- =====================================================

-- -----------------------------------------------------
-- Function: handle_new_user
-- Purpose: Auto-create user profile, quota, and welcome bonus on signup
-- Trigger: Fires on INSERT to auth.users
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  welcome_bonus_tokens BIGINT := 50000; -- 50k tokens welcome bonus
BEGIN
  -- Insert user profile (tier='free', is_admin=false, is_active=true)
  INSERT INTO public.user_profiles (id, email, tier, is_admin, is_active)
  VALUES (NEW.id, NEW.email, 'free', FALSE, TRUE);

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

-- Add comment
COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates user profile, quota, and welcome bonus (50k tokens) when new user signs up';

-- -----------------------------------------------------
-- Trigger: on_auth_user_created
-- Purpose: Call handle_new_user() on INSERT to auth.users
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- PART 3: Updated At Triggers (Auto-update timestamps)
-- =====================================================

-- -----------------------------------------------------
-- Function: update_updated_at_column
-- Purpose: Generic function to update updated_at timestamp
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.update_updated_at_column IS 'Generic function to auto-update updated_at timestamp on row updates';

-- -----------------------------------------------------
-- Trigger: update_user_profiles_updated_at
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------
-- Trigger: update_user_quotas_updated_at
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON public.user_quotas;
CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON public.user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PART 4: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_purchases ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS Policies: user_profiles
-- -----------------------------------------------------

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND tier = (SELECT tier FROM public.user_profiles WHERE id = auth.uid()) -- Prevent tier changes
    AND is_admin = (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) -- Prevent admin escalation
  );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- -----------------------------------------------------
-- RLS Policies: user_quotas
-- -----------------------------------------------------

-- Users can view their own quota
CREATE POLICY "Users can view own quota"
  ON public.user_quotas
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Service role can update quotas (for backend operations)
-- Note: This is handled via service role key, no explicit policy needed

-- Admins can view all quotas
CREATE POLICY "Admins can view all quotas"
  ON public.user_quotas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Admins can update all quotas
CREATE POLICY "Admins can update all quotas"
  ON public.user_quotas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- -----------------------------------------------------
-- RLS Policies: token_purchases
-- -----------------------------------------------------

-- Users can view their own purchase history
CREATE POLICY "Users can view own purchases"
  ON public.token_purchases
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
  ON public.token_purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- =====================================================
-- PART 5: Helper Functions for Quota Management
-- =====================================================

-- -----------------------------------------------------
-- Function: check_user_quota
-- Purpose: Check if user has sufficient tokens available
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_quota(
  p_user_id UUID,
  p_tokens_required BIGINT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tokens_available BIGINT;
BEGIN
  SELECT tokens_available INTO v_tokens_available
  FROM public.user_quotas
  WHERE user_id = p_user_id;

  IF v_tokens_available IS NULL THEN
    RETURN FALSE; -- User not found
  END IF;

  RETURN v_tokens_available >= p_tokens_required;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.check_user_quota IS 'Check if user has sufficient tokens available for a request';

-- -----------------------------------------------------
-- Function: deduct_tokens
-- Purpose: Atomically deduct tokens from user quota
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_tokens(
  p_user_id UUID,
  p_tokens_used BIGINT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tokens_available BIGINT;
BEGIN
  -- Lock row for update and check balance
  SELECT tokens_available INTO v_tokens_available
  FROM public.user_quotas
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_tokens_available IS NULL THEN
    RETURN FALSE; -- User not found
  END IF;

  IF v_tokens_available < p_tokens_used THEN
    RETURN FALSE; -- Insufficient tokens
  END IF;

  -- Deduct tokens
  UPDATE public.user_quotas
  SET
    tokens_available = tokens_available - p_tokens_used,
    tokens_used = tokens_used + p_tokens_used,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.deduct_tokens IS 'Atomically deduct tokens from user quota with balance check';

-- -----------------------------------------------------
-- Function: add_tokens
-- Purpose: Add tokens to user quota (purchases, grants)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_tokens(
  p_user_id UUID,
  p_tokens_added BIGINT,
  p_purchase_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_amount_paid DECIMAL DEFAULT NULL,
  p_currency TEXT DEFAULT 'USD'
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Add tokens to quota
  UPDATE public.user_quotas
  SET
    tokens_available = tokens_available + p_tokens_added,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE; -- User not found
  END IF;

  -- Record transaction
  INSERT INTO public.token_purchases (
    user_id,
    tokens_added,
    purchase_type,
    description,
    amount_paid,
    currency
  )
  VALUES (
    p_user_id,
    p_tokens_added,
    p_purchase_type,
    p_description,
    p_amount_paid,
    p_currency
  );

  RETURN TRUE;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.add_tokens IS 'Add tokens to user quota and record transaction (purchases, grants, bonuses)';

-- =====================================================
-- Migration Complete
-- =====================================================
