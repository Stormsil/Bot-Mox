import type { FormInstance } from 'antd';
import { AutoComplete, Form } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { AppModal } from '../../../../shared/ui';
import type { AssignLicenseFormValues, LicenseInfo } from './types';

interface AssignLicenseModalProps {
  open: boolean;
  form: FormInstance<AssignLicenseFormValues>;
  availableLicenses: LicenseInfo[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: AssignLicenseFormValues) => Promise<void>;
}

export const AssignLicenseModal: React.FC<AssignLicenseModalProps> = ({
  open,
  form,
  availableLicenses,
  submitting,
  onCancel,
  onSubmit,
}) => (
  <AppModal
    title="Assign Existing License"
    open={open}
    onOk={() => form.submit()}
    onCancel={onCancel}
    okText="Assign"
    width={500}
    confirmLoading={submitting}
    okButtonProps={{ disabled: submitting }}
  >
    <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
      <Form.Item
        name="license_id"
        label="Select License"
        rules={[{ required: true, message: 'Please select a license' }]}
      >
        <AutoComplete
          placeholder="Search and select license"
          variant="filled"
          options={availableLicenses.map((license) => ({
            value: license.id,
            label: `${license.key.substring(0, 30)}... (${license.type}) - Expires: ${dayjs(license.expires_at).format('DD.MM.YYYY')}`,
          }))}
          filterOption={(inputValue, option) =>
            option?.label?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
          }
          onSelect={(value) => form.setFieldsValue({ license_id: value })}
        />
      </Form.Item>
    </Form>
  </AppModal>
);
