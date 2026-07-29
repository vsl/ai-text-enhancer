import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateWorkflowModal } from '@/components/features/CreateWorkflowModal';

describe('CreateWorkflowModal Integration Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnCreate = jest.fn();
  const existingWorkflowNames = ['Workflow 1', 'Workflow 2', 'Test Workflow'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal opening and closing', () => {
    it('should not render when isOpen is false', () => {
      render(
        <CreateWorkflowModal
          isOpen={false}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Workflow')).toBeInTheDocument();
    });

    it('should reset form when modal opens', () => {
      const { rerender } = render(
        <CreateWorkflowModal
          isOpen={false}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      // Open modal, enter text, close
      rerender(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Some text' } });
      
      // Close and reopen
      rerender(
        <CreateWorkflowModal
          isOpen={false}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      rerender(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const newInput = screen.getByPlaceholderText('Enter workflow name') as HTMLInputElement;
      expect(newInput.value).toBe('');
    });
  });

  describe('Input validation - empty name', () => {
    it('should show error when input is empty', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      
      // Type and then delete
      await user.type(input, 'a');
      await user.clear(input);

      expect(screen.getByText('Workflow name cannot be empty.')).toBeInTheDocument();
    });

    it('should show error when input contains only whitespace', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, '   ');

      expect(screen.getByText('Workflow name cannot be empty.')).toBeInTheDocument();
    });

    it('should disable Create button when input is empty', () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Input validation - duplicate name detection', () => {
    it('should show error when name matches existing workflow (exact match)', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'Workflow 1');

      expect(screen.getByText('A workflow with this name already exists.')).toBeInTheDocument();
    });

    it('should show error when name matches existing workflow (case-insensitive)', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'WORKFLOW 1');

      expect(screen.getByText('A workflow with this name already exists.')).toBeInTheDocument();
    });

    it('should show error for mixed case duplicates', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'WoRkFlOw 2');

      expect(screen.getByText('A workflow with this name already exists.')).toBeInTheDocument();
    });

    it('should disable Create button when duplicate name is detected', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'test workflow');

      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Valid input and success state', () => {
    it('should not show error when valid unique name is entered', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'New Unique Workflow');

      expect(screen.queryByText(/cannot be empty/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });

    it('should enable Create button when valid name is entered', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'Valid New Name');

      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton).not.toBeDisabled();
    });
  });

  describe('Error message display', () => {
    it('should display error message with proper styling', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, '   ');

      const errorMessage = screen.getByText('Workflow name cannot be empty.');
      expect(errorMessage).toHaveAttribute('id', 'workflow-name-error');
      expect(errorMessage).toHaveClass('text-destructive');
    });

    it('should update error message in real-time as user types', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      
      // Type empty space - should show empty error
      await user.type(input, ' ');
      expect(screen.getByText('Workflow name cannot be empty.')).toBeInTheDocument();

      // Type duplicate name
      await user.clear(input);
      await user.type(input, 'Workflow 1');
      expect(screen.getByText('A workflow with this name already exists.')).toBeInTheDocument();

      // Type valid name - error should disappear
      await user.clear(input);
      await user.type(input, 'Valid Name');
      expect(screen.queryByText(/cannot be empty/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    });
  });

  describe('Create button functionality', () => {
    it('should call onCreate with trimmed name when Create button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, '  My New Workflow  ');

      const createButton = screen.getByRole('button', { name: /create/i });
      await user.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledTimes(1);
      expect(mockOnCreate).toHaveBeenCalledWith('My New Workflow');
    });

    it('should not call onCreate when Create button is disabled', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const createButton = screen.getByRole('button', { name: /create/i });
      
      // Button is disabled, click should not work
      await user.click(createButton);

      expect(mockOnCreate).not.toHaveBeenCalled();
    });

    it('should handle Enter key to submit form', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'Quick Workflow{Enter}');

      expect(mockOnCreate).toHaveBeenCalledTimes(1);
      expect(mockOnCreate).toHaveBeenCalledWith('Quick Workflow');
    });

    it('should not submit when Enter is pressed with invalid input', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'Workflow 1{Enter}');

      expect(mockOnCreate).not.toHaveBeenCalled();
    });
  });

  describe('Cancel button functionality', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnCreate).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard interactions', () => {
    it('should close modal when Escape key is pressed', async () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Auto-focus functionality', () => {
    it('should auto-focus the input field when modal opens', async () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter workflow name');
        expect(input).toHaveFocus();
      }, { timeout: 200 });
    });

    it('should allow typing immediately after modal opens', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      // Wait for focus
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Enter workflow name');
        expect(input).toHaveFocus();
      }, { timeout: 200 });

      // Type without explicitly clicking
      await user.keyboard('My Workflow');

      const input = screen.getByPlaceholderText('Enter workflow name') as HTMLInputElement;
      expect(input.value).toBe('My Workflow');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby');
      
      const input = screen.getByPlaceholderText('Enter workflow name');
      expect(input).toHaveAttribute('id', 'newWorkflowName');
      expect(input).toHaveAttribute('aria-describedby', 'workflow-name-error');
    });

    it('should have proper label for input', () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const label = screen.getByText('Workflow Name');
      expect(label).toHaveAttribute('for', 'newWorkflowName');
    });

    it('should have descriptive button titles', () => {
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAttribute('title', 'Cancel creation');

      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton.getAttribute('title')).toContain('workflow');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty existingWorkflowNames array', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={[]}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'First Workflow');

      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton).not.toBeDisabled();
    });

    it('should trim whitespace from comparison', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={['Workflow 1']}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, '  Workflow 1  ');

      expect(screen.getByText('A workflow with this name already exists.')).toBeInTheDocument();
    });

    it('should handle special characters in workflow names', async () => {
      const user = userEvent.setup();
      
      render(
        <CreateWorkflowModal
          isOpen={true}
          onClose={mockOnClose}
          onCreate={mockOnCreate}
          existingWorkflowNames={existingWorkflowNames}
        />
      );

      const input = screen.getByPlaceholderText('Enter workflow name');
      await user.type(input, 'Workflow @ #1 (2024)!');

      const createButton = screen.getByRole('button', { name: /create/i });
      expect(createButton).not.toBeDisabled();

      await user.click(createButton);
      expect(mockOnCreate).toHaveBeenCalledWith('Workflow @ #1 (2024)!');
    });
  });
});
