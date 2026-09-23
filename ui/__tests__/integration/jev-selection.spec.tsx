import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AssistantCard } from '@/components/features/AssistantCard';
import type { AiConfig, Result } from '@/lib/types';

const config: AiConfig = {
  id: 7,
  model: 'open-router-free',
  aiRoleId: 'editor',
  enabled: true,
  options: {
    improve: true,
    fixMistakes: true,
    format: false,
    shorten: false,
    lengthen: false,
    addEmojis: false,
    formality: 'Neutral',
    tone: 'Confident',
    languageLevel: '',
    translateTo: '',
  },
};
const result: Result = { configId: 7, text: 'Selected output', isLoading: false, error: false };
const selection = {
  status: 'success' as const,
  judge: 'jev' as const,
  model: 'typesafe/jev-1.13',
  selectedResultId: '7',
  confidence: 0.9,
  probabilities: { '7': 0.8, '8': 0.2 },
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

describe('Jev selection badge', () => {
  it('visibly and accessibly marks the selected successful card without “Best” language', () => {
    render(<AssistantCard config={config} result={result} jevSelection={selection} {...handlers} />);
    const badge = screen.getByTestId('jev-selection-7');
    expect(badge).toHaveTextContent('✨ Chosen by Jev');
    expect(badge).toHaveAttribute('title', 'Selected by Jev from the successful results in this run.');
    expect(screen.queryByText(/best/i)).not.toBeInTheDocument();
  });

  it('never marks an errored result', () => {
    render(<AssistantCard config={config} result={{ ...result, error: true }} jevSelection={selection} {...handlers} />);
    expect(screen.queryByTestId('jev-selection-7')).not.toBeInTheDocument();
  });
});
