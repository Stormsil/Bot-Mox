import { CheckCircleOutlined, LockOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { setVmSettingsSecret } from '../../../entities/vm/api/secretsFacade';
import type { SecretBinding } from '../../../shared/types';
import {
  AppButton as Button,
  AppFlex as Flex,
  AppInput as Input,
  AppModal as Modal,
  AppTag as Tag,
} from '../../../shared/ui';
import layout from './SettingsSectionLayout.module.css';

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

  const saveSecretMutation = useMutation({
    mutationFn: ({
      plaintext,
      existingSecretRef,
    }: {
      plaintext: string;
      existingSecretRef?: string;
    }) => setVmSettingsSecret(fieldName, plaintext, existingSecretRef),
  });

  const isBound = Boolean(binding);

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      message.warning('Please enter a value');
      return;
    }

    saveSecretMutation.mutate(
      {
        plaintext: trimmed,
        existingSecretRef: binding?.secret_ref,
      },
      {
        onSuccess: (newBinding) => {
          onBindingChange(fieldName, newBinding);
          message.success(isBound ? 'Secret rotated' : 'Secret set');
          setModalOpen(false);
          setValue('');
        },
      },
    );
  };

  return (
    <div className={layout.field}>
      <div className={layout.fieldLabel}>{label}</div>
      <Flex gap={8} align="center" wrap>
        {isBound ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Secret set
          </Tag>
        ) : (
          <Tag color="warning">No secret</Tag>
        )}
        <Button size="small" icon={<LockOutlined />} onClick={() => setModalOpen(true)}>
          {isBound ? 'Rotate' : 'Set'}
        </Button>
      </Flex>
      <Modal
        title={`${isBound ? 'Rotate' : 'Set'} ${label}`}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setValue('');
        }}
        confirmLoading={saveSecretMutation.isPending}
        okText={isBound ? 'Rotate' : 'Save'}
        destroyOnHidden
      >
        <p className={layout.helperText}>
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
