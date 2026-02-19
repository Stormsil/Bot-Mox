import { InputNumber, Modal, Select, Space, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

type VMProjectId = 'wow_tbc' | 'wow_midnight';

export interface CustomEditorState {
  itemId: string;
  vmName: string;
  baseProject: VMProjectId;
  cores: number;
  memoryGiB: number;
  diskGiB: number;
}

interface VMQueueCustomResourcesModalProps {
  open: boolean;
  customEditor: CustomEditorState | null;
  projectOptions: Array<{ value: VMProjectId; label: string }>;
  className: (classNames: string) => string;
  onCancel: () => void;
  onApply: () => void;
  onChange: (next: CustomEditorState) => void;
}

export const VMQueueCustomResourcesModal: React.FC<VMQueueCustomResourcesModalProps> = ({
  open,
  customEditor,
  projectOptions,
  className,
  onCancel,
  onApply,
  onChange,
}) => {
  return (
    <Modal
      title="Custom VM Resources"
      open={open}
      onCancel={onCancel}
      onOk={onApply}
      okText="Apply"
      destroyOnHidden
    >
      {customEditor ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div className={className('vm-queue-modal-field')}>
            <div className={className('vm-queue-modal-label')}>VM</div>
            <Text>{customEditor.vmName}</Text>
          </div>

          <div className={className('vm-queue-modal-field')}>
            <label htmlFor="vm-queue-custom-base-project">Base Project</label>
            <Select
              id="vm-queue-custom-base-project"
              value={customEditor.baseProject}
              options={projectOptions}
              onChange={(value) => onChange({ ...customEditor, baseProject: value })}
            />
          </div>

          <div className={className('vm-queue-modal-grid')}>
            <div className={className('vm-queue-modal-field')}>
              <label htmlFor="vm-queue-custom-cpu-cores">CPU Cores</label>
              <InputNumber
                id="vm-queue-custom-cpu-cores"
                value={customEditor.cores}
                min={1}
                max={64}
                step={1}
                style={{ width: '100%' }}
                onChange={(value) => onChange({ ...customEditor, cores: Number(value) || 1 })}
              />
            </div>

            <div className={className('vm-queue-modal-field')}>
              <label htmlFor="vm-queue-custom-ram-gib">RAM (GiB)</label>
              <InputNumber
                id="vm-queue-custom-ram-gib"
                value={customEditor.memoryGiB}
                min={1}
                max={512}
                step={1}
                style={{ width: '100%' }}
                onChange={(value) => onChange({ ...customEditor, memoryGiB: Number(value) || 1 })}
              />
            </div>

            <div className={className('vm-queue-modal-field')}>
              <label htmlFor="vm-queue-custom-disk-gib">Disk (GiB)</label>
              <InputNumber
                id="vm-queue-custom-disk-gib"
                value={customEditor.diskGiB}
                min={32}
                max={4096}
                step={1}
                style={{ width: '100%' }}
                onChange={(value) => onChange({ ...customEditor, diskGiB: Number(value) || 32 })}
              />
            </div>
          </div>
        </Space>
      ) : null}
    </Modal>
  );
};
