'use client';

import { LoginModal } from './LoginModal';
import { SignUpModal } from './SignUpModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export type AuthModalType = 'login' | 'signup' | 'forgot' | null;

interface AuthModalsProps {
  activeModal: AuthModalType;
  onClose: () => void;
  onSwitchModal: (modal: AuthModalType) => void;
}

export function AuthModals({
  activeModal,
  onClose,
  onSwitchModal,
}: AuthModalsProps) {
  return (
    <>
      <LoginModal
        isOpen={activeModal === 'login'}
        onClose={onClose}
        onSwitchToSignUp={() => onSwitchModal('signup')}
        onSwitchToForgotPassword={() => onSwitchModal('forgot')}
      />

      <SignUpModal
        isOpen={activeModal === 'signup'}
        onClose={onClose}
        onSwitchToLogin={() => onSwitchModal('login')}
      />

      <ForgotPasswordModal
        isOpen={activeModal === 'forgot'}
        onClose={onClose}
        onBackToLogin={() => onSwitchModal('login')}
      />
    </>
  );
}
