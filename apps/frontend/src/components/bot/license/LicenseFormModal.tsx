import type { FormInstance } from 'antd';
import { AutoComplete, DatePicker, Form, Input, Modal } from 'antd';
import type React from 'react';
import type { LicenseFormValues } from './types';

interface LicenseFormModalProps {
  open: boolean;
  title: string;
  okText: string;
  form: FormInstance<LicenseFormValues>;
  typeOptions: Array<{ value: string; label: string }>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: LicenseFormValues) => Promise<void>;
}

export const LicenseFormModal: React.FC<LicenseFormModalProps> = ({
  open,
  title,
  okText,
  form,
  typeOptions,
  submitting,
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
    confirmLoading={submitting}
    okButtonProps={{ disabled: submitting }}
  >
    <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
      <Form.Item
        name="key"
        label="License Key"
        rules={[{ required: true, message: 'Please enter license key' }]}
      >
        <Input placeholder="Enter license key (e.g., SIN-ABC123-DEF456)" variant="filled" />
      </Form.Item>

      <Form.Item
        name="type"
        label="Type"
        rules={[{ required: true, message: 'Please enter license type' }]}
      >
        <AutoComplete
          placeholder="Enter type (e.g., SIN, Baneto)"
          options={typeOptions}
          variant="filled"
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
        <DatePicker
          style={{ width: '100%' }}
          placeholder="DD.MM.YYYY"
          format="DD.MM.YYYY"
          variant="filled"
        />
      </Form.Item>
    </Form>
  </Modal>
);
