import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AssistantCard } from '@/components/features/AssistantCard';
import { AiConfig, Result } from '@/lib/types';

/**
 * Integration tests for DropdownMenu in AssistantCard
 * Note: Full Radix UI dropdown interaction tests are complex in JSDOM environment.
 * These tests verify the menu structure and basic accessibility.
 */
describe('DropdownMenu Integration', () => {
  const mockConfig: AiConfig = {
    id: 1,
    model: 'gemini-flash',
    aiRoleId: 'editor',
    options: {
      improve: true,
      fixMistakes: true,
      format: false,
      shorten: false,
      lengthen: false,
      addEmojis: false,
      formality: 'Formal',
      tone: 'Confident',
      languageLevel: '',
      translateTo: '',
    },
    enabled: true,
  };

  const mockResult: Result = {
    configId: 1,
    text: 'Enhanced text here',
    isLoading: false,
    error: false,
  };

  const mockHandlers = {
    onToggle: jest.fn(),
    onEdit: jest.fn(),
    onCopy: jest.fn(),
    onRemove: jest.fn(),
    onCopyResult: jest.fn(),
    onImproveVersion: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders kebab menu button', () => {
    render(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={null}
        {...mockHandlers}
      />
    );

    const menuButton = screen.getByTestId('kebab-menu-1');
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-label', 'More options');
  });

  it('has proper ARIA attributes', () => {
    render(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={null}
        {...mockHandlers}
      />
    );

    const menuButton = screen.getByTestId('kebab-menu-1');
    expect(menuButton).toHaveAttribute('aria-haspopup', 'menu');
    expect(menuButton).toHaveAttribute('type', 'button');
  });

  it('is keyboard accessible', () => {
    render(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={null}
        {...mockHandlers}
      />
    );

    const menuButton = screen.getByTestId('kebab-menu-1');
    expect(menuButton).toBeEnabled();
    expect(menuButton.tagName).toBe('BUTTON');
  });

  it('uses Radix UI DropdownMenu component', () => {
    const { container } = render(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={null}
        {...mockHandlers}
      />
    );

    const menuButton = screen.getByTestId('kebab-menu-1');
    // Radix UI adds data-state attribute
    expect(menuButton).toHaveAttribute('data-state');
  });
});
