import type { FormProps, ModalProps } from 'antd';

import type React from 'react';
import {
  AppModal,
  AppAutoComplete as AutoComplete,
  AppDatePicker as DatePicker,
  AppForm as Form,
  AppInput as Input,
} from '../../../../shared/ui';

interface LicenseFormModalProps {
  modalProps: ModalProps;
  formProps: FormProps;
  typeOptions: Array<{ value: string; label: string }>;
}

export const LicenseFormModal: React.FC<LicenseFormModalProps> = ({
  modalProps,
  formProps,
  typeOptions,
}) => (
  <AppModal {...modalProps} width={500}>
    <Form {...formProps} layout="vertical">
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
  </AppModal>
);
