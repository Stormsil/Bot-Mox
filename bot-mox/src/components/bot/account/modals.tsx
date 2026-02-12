import { Alert, Modal } from 'antd';

interface ConfirmGenerationModalProps {
  open: boolean;
  pendingGenerationType: 'password' | 'email' | 'both' | null;
  isPersonComplete: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmGenerationModal({
  open,
  pendingGenerationType,
  isPersonComplete,
  onConfirm,
  onCancel,
}: ConfirmGenerationModalProps) {
  return (
    <Modal
      title="Confirm Generation"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="Generate"
      cancelText="Cancel"
    >
      <Alert
        message="Warning"
        description="Current email and password will be replaced. Previous values have been saved and can be restored."
        type="warning"
        showIcon
        style={{ marginBottom: '16px' }}
      />
      <p>
        You are about to generate:{' '}
        <strong>
          {pendingGenerationType === 'both'
            ? 'Password and Email'
            : pendingGenerationType === 'password'
            ? 'Password'
            : 'Email'}
        </strong>
      </p>
      {pendingGenerationType !== 'password' && !isPersonComplete && (
        <Alert
          message="Person data required"
          description="Please fill in Person data (First Name, Last Name, Birth Date) before generating email."
          type="error"
          showIcon
        />
      )}
    </Modal>
  );
}
