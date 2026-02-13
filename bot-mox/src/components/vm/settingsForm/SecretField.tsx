import React, { useState } from 'react';
import { Button, Input, Modal, Tag, message } from 'antd';
import { CheckCircleOutlined, LockOutlined } from '@ant-design/icons';
import type { SecretBinding } from '../../../types';
import { setVmSettingsSecret } from '../../../services/secretsService';

interface SecretFieldProps {
  fieldName: string;
  label: string;
  binding?: SecretBinding;
  onBindingChange: (fieldName: string, binding: SecretBinding) => void;
}

export const SecretField: React.FC<SecretFieldProps> = ({
  fieldName,
  label,
  binding,
  onBindingChange,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const isBound = Boolean(binding);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      message.warning('Please enter a value');
      return;
    }

    setSaving(true);
    try {
      const newBinding = await setVmSettingsSecret(
        fieldName,
        trimmed,
        binding?.secret_ref,
      );
      onBindingChange(fieldName, newBinding);
      message.success(isBound ? 'Secret rotated' : 'Secret set');
      setModalOpen(false);
      setValue('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save secret';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vm-settings-field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isBound ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Secret set
          </Tag>
        ) : (
          <Tag color="warning">No secret</Tag>
        )}
        <Button
          size="small"
          icon={<LockOutlined />}
          onClick={() => setModalOpen(true)}
        >
          {isBound ? 'Rotate' : 'Set'}
        </Button>
      </div>
      <Modal
        title={`${isBound ? 'Rotate' : 'Set'} ${label}`}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setValue('');
        }}
        confirmLoading={saving}
        okText={isBound ? 'Rotate' : 'Save'}
        destroyOnClose
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          {isBound
            ? 'Enter a new value to replace the existing secret.'
            : 'Enter the password. It will be encrypted client-side before storage.'}
        </p>
        <Input.Password
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter password"
          autoFocus
        />
      </Modal>
    </div>
  );
};
