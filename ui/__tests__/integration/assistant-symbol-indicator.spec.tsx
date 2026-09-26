import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AssistantCard } from '@/components/features/AssistantCard';
import { ConfigEditorModal } from '@/components/features/ConfigEditorModal';
import { DEFAULT_OPTIONS, TIER_LIMITS } from '@/lib/constants';
import type { AiConfig, Result } from '@/lib/types';

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ tierLimits: TIER_LIMITS.free }),
}));

const config: AiConfig = {
  id: 7,
  model: 'open-router-free',
  aiRoleId: 'editor',
  enabled: true,
  options: { ...DEFAULT_OPTIONS, avoidCommonAiSymbols: true },
};
const result: Result = { configId: 7, text: 'Generated output', isLoading: false };
const selection = {
  status: 'success' as const,
  judge: 'jev' as const,
  model: 'typesafe/jev-1.13',
  selectedResultId: '7',
  confidence: 0.9,
  probabilities: { '7': 0.8 },
};
const handlers = {
  onToggle: jest.fn(),
  onEdit: jest.fn(),
  onCopy: jest.fn(),
  onRemove: jest.fn(),
  onCopyResult: jest.fn(),
  onImproveVersion: jest.fn(),
  copiedId: null,
};

function EditableCard({ initialConfig }: { initialConfig: AiConfig }) {
  const [savedConfig, setSavedConfig] = React.useState(initialConfig);
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <>
      <AssistantCard config={savedConfig} {...handlers} onEdit={() => setIsOpen(true)} />
      <ConfigEditorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={setSavedConfig}
        configData={savedConfig}
        mode="edit"
      />
    </>
  );
}

describe('Avoid AI symbols card indicator', () => {
  it('shows the enabled option with the configuration tags before generation and on a result card', () => {
    const { rerender } = render(<AssistantCard config={config} {...handlers} />);
    const card = screen.getByTestId('assistant-card-7');
    const summary = within(card).getByRole('button', { name: 'Edit assistant configuration' });
    expect(summary).toHaveTextContent('Avoid AI symbols');
    expect(summary).toHaveAccessibleDescription('Avoid common AI symbols is enabled for this assistant.');
    expect(within(card).getByText('Avoid AI symbols')).toBeVisible();

    rerender(<AssistantCard config={config} result={result} {...handlers} />);
    expect(within(card).getByText('Avoid AI symbols')).toBeVisible();
  });

  it('omits the indicator when the option is disabled', () => {
    render(<AssistantCard config={{ ...config, options: { ...config.options, avoidCommonAiSymbols: false } }} {...handlers} />);
    expect(screen.queryByText('Avoid AI symbols')).not.toBeInTheDocument();
  });

  it.each([true, false])('keeps the indicator with Jev selection on featured=%s result cards', (featured) => {
    render(<AssistantCard config={config} result={result} jevSelection={selection} featured={featured} {...handlers} />);
    const card = screen.getByTestId('assistant-card-7');
    expect(within(card).getByText('Chosen by Jev')).toBeVisible();
    expect(within(card).getByText('Avoid AI symbols')).toBeVisible();
  });

  it('keeps the saved configuration visible when the assistant is disabled', () => {
    render(<AssistantCard config={{ ...config, enabled: false }} {...handlers} />);
    expect(within(screen.getByTestId('assistant-card-7')).getByText('Avoid AI symbols')).toBeInTheDocument();
  });

  it('keeps the saved indicator when a draft change is cancelled', async () => {
    const user = userEvent.setup();
    render(<EditableCard initialConfig={config} />);
    const card = screen.getByTestId('assistant-card-7');
    await user.click(within(card).getByRole('button', { name: 'Edit assistant configuration' }));
    await user.click(screen.getByRole('checkbox', { name: 'Avoid common AI symbols' }));
    expect(within(card).getByText('Avoid AI symbols')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(within(card).getByText('Avoid AI symbols')).toBeVisible();
  });

  it('updates the indicator after saving the edited option', async () => {
    const user = userEvent.setup();
    render(<EditableCard initialConfig={{ ...config, options: { ...config.options, avoidCommonAiSymbols: false } }} />);
    const card = screen.getByTestId('assistant-card-7');
    await user.click(within(card).getByRole('button', { name: 'Edit assistant configuration' }));
    await user.click(screen.getByRole('checkbox', { name: 'Avoid common AI symbols' }));
    expect(within(card).queryByText('Avoid AI symbols')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(within(card).getByText('Avoid AI symbols')).toBeVisible();
  });
});
