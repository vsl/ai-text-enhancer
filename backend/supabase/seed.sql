-- =====================================================
-- Seed Data for Local Development
-- Created: 2025-10-25
-- Description: Bootstrap test users for local development
-- =====================================================
--
-- This file is IDEMPOTENT - safe to run multiple times
-- It will NOT create duplicate users if they already exist
--
-- Bootstrap Users:
-- 1. admin@textenhancer.dev - Admin user (premium, 10M tokens)
-- 2. free@textenhancer.dev - Free tier test user (50k tokens)
-- 3. plus@textenhancer.dev - Plus tier test user (500k tokens)
-- 4. premium@textenhancer.dev - Premium tier test user (5M tokens)
-- 5. zero@textenhancer.dev - Zero balance test user (0 tokens)
-- 6. blocked@textenhancer.dev - Blocked user test (10k tokens, is_active=false)
-- =====================================================

BEGIN;

-- =====================================================
-- Helper: Delete existing bootstrap users (for clean re-seeding)
-- =====================================================
-- Uncomment the following lines if you want to delete existing bootstrap users
-- and recreate them from scratch (useful for resetting test data)
--
-- DELETE FROM auth.users WHERE email IN (
--   'admin@textenhancer.dev',
--   'free@textenhancer.dev',
--   'plus@textenhancer.dev',
--   'premium@textenhancer.dev',
--   'zero@textenhancer.dev',
--   'blocked@textenhancer.dev'
-- );

-- =====================================================
-- User 1: Admin User (premium tier, admin privileges)
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@textenhancer.dev';

  IF v_user_id IS NULL THEN
    -- Create user in auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'admin@textenhancer.dev',
      crypt('Admin_2025_Secure!', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    -- Update user profile to admin with premium tier
    UPDATE public.user_profiles
    SET
      tier = 'premium',
      is_admin = TRUE
    WHERE id = v_user_id;

    -- Set token balance to 10M tokens
    UPDATE public.user_quotas
    SET tokens_available = 10000000
    WHERE user_id = v_user_id;

    -- Update purchase record
    UPDATE public.token_purchases
    SET
      tokens_added = 10000000,
      description = 'Admin user - initial token grant (10M tokens)'
    WHERE user_id = v_user_id AND purchase_type = 'registration';

    RAISE NOTICE 'Created admin user: admin@textenhancer.dev';
  ELSE
    RAISE NOTICE 'Admin user already exists: admin@textenhancer.dev';
  END IF;
END $$;

-- =====================================================
-- User 2: Free Tier Test User
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'free@textenhancer.dev';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'free@textenhancer.dev',
      crypt('Free_User_2025', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    );

    RAISE NOTICE 'Created free tier user: free@textenhancer.dev';
  ELSE
    RAISE NOTICE 'Free tier user already exists: free@textenhancer.dev';
  END IF;
END $$;

-- =====================================================
-- User 3: Plus Tier Test User
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'plus@textenhancer.dev';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'plus@textenhancer.dev',
      crypt('Plus_User_2025', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    -- Upgrade to plus tier
    UPDATE public.user_profiles
    SET tier = 'plus'
    WHERE id = v_user_id;

    -- Set token balance to 500k tokens
    UPDATE public.user_quotas
    SET tokens_available = 500000
    WHERE user_id = v_user_id;

    -- Update purchase record
    UPDATE public.token_purchases
    SET
      tokens_added = 500000,
      description = 'Plus tier user - initial token grant (500k tokens)'
    WHERE user_id = v_user_id AND purchase_type = 'registration';

    RAISE NOTICE 'Created plus tier user: plus@textenhancer.dev';
  ELSE
    RAISE NOTICE 'Plus tier user already exists: plus@textenhancer.dev';
  END IF;
END $$;

-- =====================================================
-- User 4: Premium Tier Test User
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'premium@textenhancer.dev';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'premium@textenhancer.dev',
      crypt('Premium_User_2025', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    -- Upgrade to premium tier
    UPDATE public.user_profiles
    SET tier = 'premium'
    WHERE id = v_user_id;

    -- Set token balance to 5M tokens
    UPDATE public.user_quotas
    SET tokens_available = 5000000
    WHERE user_id = v_user_id;

    -- Update purchase record
    UPDATE public.token_purchases
    SET
      tokens_added = 5000000,
      description = 'Premium tier user - initial token grant (5M tokens)'
    WHERE user_id = v_user_id AND purchase_type = 'registration';

    RAISE NOTICE 'Created premium tier user: premium@textenhancer.dev';
  ELSE
    RAISE NOTICE 'Premium tier user already exists: premium@textenhancer.dev';
  END IF;
END $$;

-- =====================================================
-- User 5: Zero Balance Test User (for quota testing)
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'zero@textenhancer.dev';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'zero@textenhancer.dev',
      crypt('Zero_Tokens_2025', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    -- Set token balance to 0 and reset usage counter
    UPDATE public.user_quotas
    SET
      tokens_available = 0,
      tokens_used = 50000  -- They used their welcome bonus
    WHERE user_id = v_user_id;

    -- Delete the auto-created welcome bonus record (or keep it to show they used it all)
    -- We'll keep the purchase record to maintain transaction history

    RAISE NOTICE 'Created zero balance user: zero@textenhancer.dev';
  ELSE
    RAISE NOTICE 'Zero balance user already exists: zero@textenhancer.dev';
  END IF;
END $$;

-- =====================================================
-- User 6: Blocked User (for access denial testing)
-- =====================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'blocked@textenhancer.dev';

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'blocked@textenhancer.dev',
      crypt('Blocked_User_2025', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      FALSE,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    -- Set user as blocked (is_active = false)
    UPDATE public.user_profiles
    SET is_active = FALSE
    WHERE id = v_user_id;

    -- Set token balance to 10k tokens
    UPDATE public.user_quotas
    SET tokens_available = 10000
    WHERE user_id = v_user_id;

    -- Update purchase record
    UPDATE public.token_purchases
    SET
      tokens_added = 10000,
      description = 'Blocked user - for access denial testing'
    WHERE user_id = v_user_id AND purchase_type = 'registration';

    RAISE NOTICE 'Created blocked user: blocked@textenhancer.dev';
  ELSE
    RAISE NOTICE 'Blocked user already exists: blocked@textenhancer.dev';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- Seed Complete - Summary
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Seed Data Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. admin@textenhancer.dev - Password: Admin_2025_Secure!';
  RAISE NOTICE '   Tier: premium | Admin: YES | Tokens: 10,000,000 | Status: Active';
  RAISE NOTICE '';
  RAISE NOTICE '2. free@textenhancer.dev - Password: Free_User_2025';
  RAISE NOTICE '   Tier: free | Admin: NO | Tokens: 50,000 | Status: Active';
  RAISE NOTICE '';
  RAISE NOTICE '3. plus@textenhancer.dev - Password: Plus_User_2025';
  RAISE NOTICE '   Tier: plus | Admin: NO | Tokens: 500,000 | Status: Active';
  RAISE NOTICE '';
  RAISE NOTICE '4. premium@textenhancer.dev - Password: Premium_User_2025';
  RAISE NOTICE '   Tier: premium | Admin: NO | Tokens: 5,000,000 | Status: Active';
  RAISE NOTICE '';
  RAISE NOTICE '5. zero@textenhancer.dev - Password: Zero_Tokens_2025';
  RAISE NOTICE '   Tier: free | Admin: NO | Tokens: 0 | Status: Active';
  RAISE NOTICE '';
  RAISE NOTICE '6. blocked@textenhancer.dev - Password: Blocked_User_2025';
  RAISE NOTICE '   Tier: free | Admin: NO | Tokens: 10,000 | Status: BLOCKED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
