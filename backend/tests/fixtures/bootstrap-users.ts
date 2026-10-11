// Local test data only. Runtime accounts must use explicit server configuration.
import type { BootstrapUser } from '../../src/types/admin.types.ts';

export const BOOTSTRAP_USERS: BootstrapUser[] = [
      {
        email: 'admin@textenhancer.dev',
        password: 'Admin_2025_Secure!',
        tier: 'premium',
        isAdmin: true,
        tokens: 10_000_000,
        isActive: true,
        description: 'Admin user - initial token grant (10M tokens)',
      },
      {
        email: 'free@textenhancer.dev',
        password: 'Free_User_2025',
        tier: 'free',
        isAdmin: false,
        tokens: 50_000,
        isActive: true,
        description: 'Free tier user - welcome bonus (50k tokens)',
      },
      {
        email: 'plus@textenhancer.dev',
        password: 'Plus_User_2025',
        tier: 'plus',
        isAdmin: false,
        tokens: 500_000,
        isActive: true,
        description: 'Plus tier user - initial token grant (500k tokens)',
      },
      {
        email: 'premium@textenhancer.dev',
        password: 'Premium_User_2025',
        tier: 'premium',
        isAdmin: false,
        tokens: 5_000_000,
        isActive: true,
        description: 'Premium tier user - initial token grant (5M tokens)',
      },
      {
        email: 'zero@textenhancer.dev',
        password: 'Zero_Tokens_2025',
        tier: 'free',
        isAdmin: false,
        tokens: 0,
        isActive: true,
        description: 'Zero balance user - for quota testing',
      },
      {
        email: 'blocked@textenhancer.dev',
        password: 'Blocked_User_2025',
        tier: 'free',
        isAdmin: false,
        tokens: 10_000,
        isActive: false,
        description: 'Blocked user - for access denial testing',
      },
    ];
