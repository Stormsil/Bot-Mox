import React from 'react';
import { AutoComplete, DatePicker, Form, Input, Modal } from 'antd';
import type { FormInstance } from 'antd';
import type { LicenseFormValues } from './types';

interface LicenseFormModalProps {
  open: boolean;
  title: string;
  okText: string;
  form: FormInstance<LicenseFormValues>;
  typeOptions: Array<{ value: string; label: string }>;
  onCancel: () => void;
  onSubmit: (values: LicenseFormValues) => Promise<void>;
}

export const LicenseFormModal: React.FC<LicenseFormModalProps> = ({
  open,
  title,
  okText,
  form,
  typeOptions,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title={title}
    open={open}
    onOk={() => form.submit()}
    onCancel={onCancel}
    okText={okText}
    width={500}
  >
    <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
      <Form.Item
        name="key"
        label="License Key"
        rules={[{ required: true, message: 'Please enter license key' }]}
      >
        <Input placeholder="Enter license key (e.g., SIN-ABC123-DEF456)" />
      </Form.Item>

      <Form.Item
        name="type"
        label="Type"
        rules={[{ required: true, message: 'Please enter license type' }]}
      >
        <AutoComplete
          placeholder="Enter type (e.g., SIN, Baneto)"
          options={typeOptions}
          filterOption={(inputValue, option) =>
            option?.value?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
          }
        />
      </Form.Item>

      <Form.Item
        name="expires_at"
        label="Expiration Date"
        rules={[{ required: true, message: 'Please select expiration date' }]}
      >
        <DatePicker style={{ width: '100%' }} placeholder="DD.MM.YYYY" format="DD.MM.YYYY" />
      </Form.Item>
    </Form>
  </Modal>
);
