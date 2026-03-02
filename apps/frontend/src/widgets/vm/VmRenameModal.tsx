import type React from 'react';
import type { ProxmoxVM } from '../../shared/types';
import { AppInput as Input, AppModal as Modal } from '../../shared/ui';

interface VmRenameModalProps {
  target: ProxmoxVM | null;
  value: string;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => Promise<void> | void;
  saving: boolean;
}

export const VmRenameModal: React.FC<VmRenameModalProps> = ({
  target,
  value,
  onValueChange,
  onCancel,
  onSubmit,
  saving,
}) => {
  return (
    <Modal
      title={target ? `Rename VM ${target.vmid}` : 'Rename VM'}
      open={Boolean(target)}
      onCancel={onCancel}
      onOk={() => void onSubmit()}
      okText="Rename"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        maxLength={64}
        placeholder="Enter VM name"
        onPressEnter={() => {
          if (!saving) {
            void onSubmit();
          }
        }}
      />
    </Modal>
  );
};
