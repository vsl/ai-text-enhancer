import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Loading from '@/app/loading';
import TextAIAssistantsLoading from '@/app/text-ai-assistants/loading';

describe('Loading States', () => {
  describe('Root loading', () => {
    it('renders loading spinner', () => {
      render(<Loading />);

      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('renders screen reader text', () => {
      render(<Loading />);

      const srText = screen.getByText('Loading application...');
      expect(srText).toHaveClass('sr-only');
    });

    it('renders visible loading text', () => {
      render(<Loading />);

      const visibleText = screen.getByText('Loading...');
      expect(visibleText).toBeInTheDocument();
      expect(visibleText).toHaveClass('text-muted-foreground');
    });

    it('centers content on screen', () => {
      const { container } = render(<Loading />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'min-h-screen');
    });
  });

  describe('Text AI Assistants loading', () => {
    it('renders loading spinner', () => {
      render(<TextAIAssistantsLoading />);

      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('renders screen reader text', () => {
      render(<TextAIAssistantsLoading />);

      const srText = screen.getByText('Loading AI Text Enhancer...');
      expect(srText).toHaveClass('sr-only');
    });

    it('renders visible loading text', () => {
      render(<TextAIAssistantsLoading />);

      const visibleText = screen.getByText('Loading your workspace...');
      expect(visibleText).toBeInTheDocument();
      expect(visibleText).toHaveClass('text-muted-foreground');
    });

    it('centers content on screen', () => {
      const { container } = render(<TextAIAssistantsLoading />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'min-h-screen');
    });
  });
});
