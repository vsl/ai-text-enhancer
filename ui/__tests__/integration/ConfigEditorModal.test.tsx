import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigEditorModal } from '@/components/features/ConfigEditorModal';
import { AiConfig } from '@/lib/types';
import { DEFAULT_OPTIONS, TIER_LIMITS } from '@/lib/constants';

// Mock AuthContext before imports
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    profile: null,
    tierLimits: TIER_LIMITS.free,
    getAuthToken: jest.fn().mockResolvedValue('anonymous'),
    resetSession: jest.fn(),
    updateTokenBalance: jest.fn(),
  }),
}));

describe('ConfigEditorModal Integration Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

  const sampleConfig: AiConfig = {
    id: 1,
    model: 'open-router-free',
    aiRoleId: 'editor',
    options: { ...DEFAULT_OPTIONS },
    enabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Modal opening and closing', () => {
    it('should not render when isOpen is false', () => {
      render(
        <ConfigEditorModal
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should display correct title in edit mode', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      expect(screen.getByText('Edit assistant')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'General Assistant' })).toBeInTheDocument();
    });

    it('should display correct title in add mode', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      expect(screen.getByText('Add assistant')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'New AI Assistant' })).toBeInTheDocument();
    });
  });

  describe('Form initialization', () => {
    it('should initialize form with provided config data', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('open-router-free');

      const aiRoleSelect = screen.getByRole('combobox', { name: /ai role/i }) as HTMLSelectElement;
      expect(aiRoleSelect.value).toBe('editor');
    });

    it('should reset form when modal reopens with new data', () => {
      const { rerender } = render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const newConfig: AiConfig = {
        ...sampleConfig,
        model: 'open-router-free',
        aiRoleId: 'summarizer',
      };

      rerender(
        <ConfigEditorModal
          isOpen={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={newConfig}
          mode="edit"
        />
      );

      rerender(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={newConfig}
          mode="edit"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('open-router-free');

      const aiRoleSelect = screen.getByRole('combobox', { name: /ai role/i }) as HTMLSelectElement;
      expect(aiRoleSelect.value).toBe('summarizer');
    });
  });

  describe('Base Setup section', () => {
    it('should change model selection', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'openai-gpt-5-nano');

      expect((modelSelect as HTMLSelectElement).value).toBe('openai-gpt-5-nano');
    });

    it('should change AI Role selection', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const aiRoleSelect = screen.getByRole('combobox', { name: /ai role/i });
      await user.selectOptions(aiRoleSelect, 'Professional Email Assistant');

      expect((aiRoleSelect as HTMLSelectElement).value).toBe('email_assistant');
    });
  });

  describe('Actions section - Checkboxes', () => {
    it('saves the Avoid common AI symbols toggle in both states', async () => {
      const user = userEvent.setup();
      render(<ConfigEditorModal isOpen onClose={mockOnClose} onSave={mockOnSave} configData={sampleConfig} mode="edit" />);
      const checkbox = screen.getByRole('checkbox', { name: 'Avoid common AI symbols' }) as HTMLInputElement;
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      await user.click(screen.getByRole('button', { name: /save/i }));
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ avoidCommonAiSymbols: false }) }));
    });

    it('should toggle improve checkbox', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const improveCheckbox = screen.getByRole('checkbox', { name: /improve/i }) as HTMLInputElement;
      const initialState = improveCheckbox.checked;

      await user.click(improveCheckbox);
      expect(improveCheckbox.checked).toBe(!initialState);
    });

    it('should toggle all action checkboxes independently', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const checkboxes = [
        'improve',
        'fix mistakes',
        'format',
        'shorten',
        'lengthen',
        'add emojis',
        'avoid common ai symbols'
      ];

      for (const label of checkboxes) {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(label, 'i') }) as HTMLInputElement;
        const initialState = checkbox.checked;
        await user.click(checkbox);
        expect(checkbox.checked).toBe(!initialState);
      }
    });
  });

  describe('Mutual exclusivity - Shorten/Lengthen', () => {
    it('should uncheck lengthen when shorten is checked', async () => {
      const user = userEvent.setup();
      
      const configWithLengthen: AiConfig = {
        ...sampleConfig,
        options: { ...sampleConfig.options, lengthen: true, shorten: false },
      };

      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={configWithLengthen}
          mode="add"
        />
      );

      const shortenCheckbox = screen.getByRole('checkbox', { name: /shorten/i }) as HTMLInputElement;
      const lengthenCheckbox = screen.getByRole('checkbox', { name: /lengthen/i }) as HTMLInputElement;

      expect(lengthenCheckbox.checked).toBe(true);
      expect(shortenCheckbox.checked).toBe(false);

      await user.click(shortenCheckbox);

      expect(shortenCheckbox.checked).toBe(true);
      expect(lengthenCheckbox.checked).toBe(false);
    });

    it('should uncheck shorten when lengthen is checked', async () => {
      const user = userEvent.setup();
      
      const configWithShorten: AiConfig = {
        ...sampleConfig,
        options: { ...sampleConfig.options, shorten: true, lengthen: false },
      };

      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={configWithShorten}
          mode="add"
        />
      );

      const shortenCheckbox = screen.getByRole('checkbox', { name: /shorten/i }) as HTMLInputElement;
      const lengthenCheckbox = screen.getByRole('checkbox', { name: /lengthen/i }) as HTMLInputElement;

      expect(shortenCheckbox.checked).toBe(true);
      expect(lengthenCheckbox.checked).toBe(false);

      await user.click(lengthenCheckbox);

      expect(lengthenCheckbox.checked).toBe(true);
      expect(shortenCheckbox.checked).toBe(false);
    });

    it('should allow both to be unchecked', async () => {
      const user = userEvent.setup();
      
      const configWithShorten: AiConfig = {
        ...sampleConfig,
        options: { ...sampleConfig.options, shorten: true, lengthen: false },
      };

      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={configWithShorten}
          mode="add"
        />
      );

      const shortenCheckbox = screen.getByRole('checkbox', { name: /shorten/i }) as HTMLInputElement;
      const lengthenCheckbox = screen.getByRole('checkbox', { name: /lengthen/i }) as HTMLInputElement;

      await user.click(shortenCheckbox);

      expect(shortenCheckbox.checked).toBe(false);
      expect(lengthenCheckbox.checked).toBe(false);
    });
  });

  describe('Style section', () => {
    it('should change formality selection', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const formalitySelect = screen.getByRole('combobox', { name: /formality/i });
      await user.selectOptions(formalitySelect, 'Formal');

      expect((formalitySelect as HTMLSelectElement).value).toBe('Formal');
    });

    it('should change tone selection', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const toneSelect = screen.getByRole('combobox', { name: /tone/i });
      await user.selectOptions(toneSelect, 'Polite');

      expect((toneSelect as HTMLSelectElement).value).toBe('Polite');
    });

    it('shows formality without a decorative emoji', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const formalityLabel = screen.getByText(/formality/i);
      expect(formalityLabel.textContent).not.toContain('😐');
    });

    it('shows tone without a decorative emoji', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const toneLabel = screen.getByText(/tone/i);
      expect(toneLabel.textContent).not.toContain('😎');
    });
  });

  describe('Language section', () => {
    it('should change language level', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const levelSelect = screen.getByRole('combobox', { name: /^level/i });
      await user.selectOptions(levelSelect, 'simple');

      expect((levelSelect as HTMLSelectElement).value).toBe('simple');
    });

    it('should change translate to selection', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const translateSelect = screen.getByRole('combobox', { name: /translate to/i });
      await user.selectOptions(translateSelect, 'es');

      expect((translateSelect as HTMLSelectElement).value).toBe('es');
    });
  });

  describe('Save button state - Add mode', () => {
    it('should enable Save button in add mode even without changes', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should keep Save button enabled after changes in add mode', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'openai-gpt-5-nano');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Save button state - Edit mode', () => {
    it('should disable Save button in edit mode when no changes made', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button in edit mode after making changes', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton).toBeDisabled();

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'openai-gpt-5-nano');

      expect(saveButton).not.toBeDisabled();
    });

    it('should track dirty state across multiple field changes', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      
      // Make multiple changes
      const improveCheckbox = screen.getByRole('checkbox', { name: /improve/i });
      await user.click(improveCheckbox);

      const formalitySelect = screen.getByRole('combobox', { name: /formality/i });
      await user.selectOptions(formalitySelect, 'Formal');

      expect(saveButton).not.toBeDisabled();
    });

    it('should disable Save button if changes are reverted', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      const modelSelect = screen.getByRole('combobox', { name: /model/i });

      // Change value
      await user.selectOptions(modelSelect, 'openai-gpt-5-nano');
      expect(saveButton).not.toBeDisabled();

      // Revert value
      await user.selectOptions(modelSelect, 'open-router-free');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Save functionality', () => {
    it('should call onSave with updated config when Save is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'open-router-free');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'open-router-free',
        })
      );
    });

    it('should call onSave with multiple field changes', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'open-router-free');

      const aiRoleSelect = screen.getByRole('combobox', { name: /ai role/i });
      await user.selectOptions(aiRoleSelect, 'summarizer');

      const formatCheckbox = screen.getByRole('checkbox', { name: /format/i });
      await user.click(formatCheckbox);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'open-router-free',
          aiRoleId: 'summarizer',
          options: expect.objectContaining({
            format: true,
          }),
        })
      );
    });

    it('should preserve unchanged fields when saving', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'open-router-free');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          aiRoleId: 'editor',
          enabled: true,
        })
      );
    });
  });

  describe('Cancel functionality', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should not save changes when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'open-router-free');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard interactions', () => {
    it('should close modal when Escape key is pressed', async () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Form sections structure', () => {
    it('should render all form sections', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      expect(screen.getByText('Base setup')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Writing style')).toBeInTheDocument();
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    it('should render all action checkboxes', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      expect(screen.getByRole('checkbox', { name: /improve/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /fix mistakes/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /format/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /shorten/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /lengthen/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /add emojis/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('should have proper labels for all form fields', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      expect(screen.getByRole('combobox', { name: /model/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /ai role/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /formality/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /tone/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /^level/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /translate to/i })).toBeInTheDocument();
    });

    it('should have descriptive button titles', () => {
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="edit"
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveAttribute('title', 'Discard changes and close editor');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      expect(saveButton.getAttribute('title')).toBeTruthy();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle rapid sequential changes correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'open-router-free');
      await user.selectOptions(modelSelect, 'open-router-free');

      const improveCheckbox = screen.getByRole('checkbox', { name: /improve/i });
      await user.click(improveCheckbox);
      await user.click(improveCheckbox);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'open-router-free',
          options: expect.objectContaining({
            improve: true, // Back to original state
          }),
        })
      );
    });

    it('should maintain form state during re-renders', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      const modelSelect = screen.getByRole('combobox', { name: /model/i });
      await user.selectOptions(modelSelect, 'open-router-free');

      // Re-render with same props
      rerender(
        <ConfigEditorModal
          isOpen={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          configData={sampleConfig}
          mode="add"
        />
      );

      expect((modelSelect as HTMLSelectElement).value).toBe('open-router-free');
    });
  });
});
