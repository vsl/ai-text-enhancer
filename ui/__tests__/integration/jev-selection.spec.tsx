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
  it('shows a rejected result at 0% with its reason and no winner badge', () => {
    render(<AssistantCard config={config} result={result} jevSelection={{ ...selection,
      selectedResultId: null, probabilities: { '7': 0 },
      rejectionReasons: { '7': ['INSTRUCTION_FOLLOWING', 'EM_DASH'] },
    }} {...handlers} />);
    expect(screen.getByTestId('jev-probability-7')).toHaveTextContent('Jev 0%');
    expect(screen.getByRole('status')).toHaveTextContent('followed an embedded instruction');
    expect(screen.getByRole('status')).toHaveTextContent('contains an em dash');
    expect(screen.queryByTestId('jev-selection-7')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Generated text')).toHaveValue('Selected output');
  });
  it('visibly and accessibly marks the selected successful card without “Best” language', () => {
    render(<AssistantCard config={config} result={result} jevSelection={selection} featured {...handlers} />);
    const badge = screen.getByTestId('jev-selection-7');
    expect(badge).toHaveTextContent('Chosen by Jev');
    expect(badge).toHaveAttribute('title', 'Selected by Jev from the successful results in this run.');
    expect(screen.getByTestId('jev-probability-7')).toHaveTextContent('Jev 80%');
    expect(screen.getByTestId('assistant-card-7')).toHaveClass('border-violet-border');
    expect(screen.queryByText(/best|confidence/i)).not.toBeInTheDocument();
  });

  it('shows a probability on successful unselected results without another badge', () => {
    render(<AssistantCard config={config} result={result} jevSelection={{ ...selection, selectedResultId: '8' }} {...handlers} />);
    expect(screen.getByTestId('jev-probability-7')).toHaveTextContent('Jev 80%');
    expect(screen.queryByTestId('jev-selection-7')).not.toBeInTheDocument();
  });

  it('shows small positive probability without rounding it to zero', () => {
    render(<AssistantCard config={config} result={result} jevSelection={{ ...selection, probabilities: { '7': 0.004 } }} {...handlers} />);
    expect(screen.getByTestId('jev-probability-7')).toHaveTextContent('Jev <1%');
  });

  it('stays compact before generation with a human-readable model name', () => {
    render(<AssistantCard config={config} {...handlers} />);
    expect(screen.getByText('OpenRouter Free')).toBeInTheDocument();
    expect(screen.queryByText(/Ready to enhance/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Generated text')).not.toBeInTheDocument();
  });

  it('never marks an errored result', () => {
    render(<AssistantCard config={config} result={{ ...result, error: true }} jevSelection={selection} {...handlers} />);
    expect(screen.queryByTestId('jev-selection-7')).not.toBeInTheDocument();
  });
});
