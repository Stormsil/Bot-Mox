import type { UploadProps } from 'antd';
import { Button, Modal, Select, Space, Typography, Upload } from 'antd';
import type React from 'react';
import type { UnattendProfile } from '../../entities/vm/api/unattendProfileFacade';

interface VMQueueUnattendModalProps {
  open: boolean;
  className: (classNames: string) => string;
  unattendEditor: { itemId: string; profileId?: string; xmlOverride: string } | null;
  unattendProfiles: UnattendProfile[];
  unattendProfilesLoading: boolean;
  unattendEditorError: string | null;
  activeUnattendPreview: {
    profile?: UnattendProfile | null;
    finalXml: string;
  } | null;
  onCancel: () => void;
  onApply: () => void;
  onProfileChange: (value?: string) => void;
  onImportBeforeUpload: UploadProps['beforeUpload'];
  onUseProfileTemplate: () => void;
  onExportTemplate: () => void;
  onExportFinal: () => void;
}

export const VMQueueUnattendModal: React.FC<VMQueueUnattendModalProps> = ({
  open,
  className,
  unattendEditor,
  unattendProfiles,
  unattendProfilesLoading,
  unattendEditorError,
  activeUnattendPreview,
  onCancel,
  onApply,
  onProfileChange,
  onImportBeforeUpload,
  onUseProfileTemplate,
  onExportTemplate,
  onExportFinal,
}) => {
  return (
    <Modal
      title="Queue VM Unattend XML"
      open={open}
      onCancel={onCancel}
      onOk={onApply}
      okText="Apply"
      destroyOnHidden
      width={820}
    >
      {unattendEditor ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div className={className('vm-queue-modal-field')}>
            <label htmlFor="vm-queue-unattend-profile">Profile</label>
            <Select
              id="vm-queue-unattend-profile"
              placeholder="Select profile"
              value={unattendEditor.profileId}
              onChange={(value) => onProfileChange(value)}
              options={unattendProfiles.map((profile) => ({
                value: profile.id,
                label: profile.is_default ? `${profile.name} (default)` : profile.name,
              }))}
              allowClear
              loading={unattendProfilesLoading}
            />
          </div>

          <Space wrap>
            <Upload
              beforeUpload={onImportBeforeUpload}
              showUploadList={false}
              accept=".xml,text/xml,application/xml"
            >
              <Button size="small">Import VM XML Override</Button>
            </Upload>
            <Button size="small" onClick={onUseProfileTemplate}>
              Use Profile Template
            </Button>
            <Button size="small" onClick={onExportTemplate}>
              Export Template
            </Button>
            <Button type="primary" size="small" onClick={onExportFinal}>
              Export Final XML
            </Button>
          </Space>

          {unattendEditorError ? (
            <div className={className('vm-queue-unattend-error')}>{unattendEditorError}</div>
          ) : null}

          <div className={className('vm-queue-modal-field')}>
            <div className={className('vm-queue-modal-label')}>Current Source</div>
            <Typography.Text type="secondary">
              {String(unattendEditor.xmlOverride || '').trim()
                ? 'Per-VM XML override'
                : `Profile template${activeUnattendPreview?.profile ? `: ${activeUnattendPreview.profile.name}` : ''}`}
            </Typography.Text>
          </div>

          <div className={className('vm-queue-modal-field')}>
            <label htmlFor="vm-queue-final-xml-preview">Final XML Preview</label>
            <textarea
              id="vm-queue-final-xml-preview"
              className={className('vm-queue-unattend-preview')}
              value={activeUnattendPreview?.finalXml || ''}
              readOnly
            />
          </div>
        </Space>
      ) : null}
    </Modal>
  );
};
