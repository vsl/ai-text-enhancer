import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AssistantCard } from '@/components/features/AssistantCard';
import { AiConfig, Result } from '@/lib/types';

describe('Copy Button Feedback', () => {
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
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('shows Check icon after copying', async () => {
    const { rerender } = render(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={null}
        {...mockHandlers}
      />
    );

    const copyButton = screen.getByTestId('copy-result-1');

    // Initially should show copy icon (SVG)
    expect(copyButton.querySelector('svg')).toBeInTheDocument();

    // Click copy button
    fireEvent.click(copyButton);
    expect(mockHandlers.onCopyResult).toHaveBeenCalledWith('Enhanced text here', 1);

    // Rerender with copiedId set
    rerender(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={1}
        {...mockHandlers}
      />
    );

    // Should now show Check icon instead
    await waitFor(() => {
      expect(screen.getByLabelText('Copied!')).toBeInTheDocument();
    });
  });

  it('reverts back to copy icon after timeout', async () => {
    const { rerender } = render(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={1}
        {...mockHandlers}
      />
    );

    // Should show Check icon
    expect(screen.getByLabelText('Copied!')).toBeInTheDocument();

    // Simulate timeout by changing copiedId back to null
    rerender(
      <AssistantCard
        config={mockConfig}
        result={mockResult}
        copiedId={null}
        {...mockHandlers}
      />
    );

    // Should show copy icon again
    expect(screen.getByLabelText('Copy result to clipboard')).toBeInTheDocument();
  });

  it('shows correct icon for different configs', () => {
    const config2 = { ...mockConfig, id: 2 };
    const result2 = { ...mockResult, configId: 2 };

    render(
      <>
        <AssistantCard
          config={mockConfig}
          result={mockResult}
          copiedId={1}
          {...mockHandlers}
        />
        <AssistantCard
          config={config2}
          result={result2}
          copiedId={1}
          {...mockHandlers}
        />
      </>
    );

    // First card should show Check icon
    const button1 = screen.getByTestId('copy-result-1');
    expect(button1).toHaveAttribute('aria-label', 'Copied!');

    // Second card should show copy icon
    const button2 = screen.getByTestId('copy-result-2');
    expect(button2).toHaveAttribute('aria-label', 'Copy result to clipboard');
  });
});
