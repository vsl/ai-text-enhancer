import React from 'react';
import { render, screen } from '@testing-library/react';
import { TIER_LIMITS } from '@/lib/constants';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('../../src/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    profile: {
      id: 'anonymous-user',
      email: 'anonymous-user@anon.local',
      tier: 'free',
      tokens_available: 50000,
      tokens_used: 0,
      auth_provider: 'anonymous',
      created_at: '2026-01-01T00:00:00Z',
      is_anonymous: true,
    },
    tierLimits: TIER_LIMITS.free,
    getAuthToken: jest.fn(),
    resetSession: jest.fn(),
    updateTokenBalance: jest.fn(),
  }),
}));
jest.mock('../../src/context/WorkflowContext', () => ({
  WorkflowProvider: ({ children }: { children: React.ReactNode }) => children,
  useWorkflow: () => ({
    workflows: [{ name: 'Quick Fix', configs: [] }],
    selectedWorkflow: 'Quick Fix',
    configs: [],
    results: new Map(),
    isGenerating: false,
    inputText: '',
    contextText: '',
    handleCreateWorkflow: jest.fn(),
    handleLoadWorkflow: jest.fn(),
    handleDeleteWorkflow: jest.fn(),
    handleSaveConfig: jest.fn(),
    handleRemoveConfig: jest.fn(),
    handleToggleAssistant: jest.fn(),
    handleCopyConfig: jest.fn(),
    setInputText: jest.fn(),
    setContextText: jest.fn(),
    handleGenerate: jest.fn(),
    handleCancel: jest.fn(),
  }),
}));

import { Header } from '@/components/features/Header';
import TextAIAssistantsPage from '@/app/text-ai-assistants/page';

describe('public anonymous demo UI', () => {
  it('shows weekly usage without account, pricing, or payment controls', () => {
    render(
      <>
        <Header />
        <TextAIAssistantsPage />
      </>
    );

    expect(screen.getByLabelText('Weekly demo allowance')).toBeInTheDocument();
    expect(screen.getByText('50,000 tokens left')).toBeInTheDocument();
    expect(screen.getByText('resets Monday 00:00 UTC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'App' })).toHaveAttribute('href', '/text-ai-assistants');
    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quick Fix' })).toBeInTheDocument();
    expect(screen.queryByText(/sign in|sign up|log in|account|pricing|payment|purchase|upgrade/i)).not.toBeInTheDocument();
  });
});
