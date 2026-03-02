import type { FormInstance, FormProps, ModalProps } from 'antd';
import { DatePicker, Form, Input, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type React from 'react';
import { AppModal } from '../../../shared/ui';
import type { AddBotFormValues, BotsMap } from './types';

const { Option } = Select;

function toDayjsValue(value: unknown): Dayjs | null {
  if (dayjs.isDayjs(value)) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : null;
  }
  return null;
}

interface LicenseEditorModalProps {
  modalProps: ModalProps;
  formProps: FormProps;
}

export const LicenseEditorModal: React.FC<LicenseEditorModalProps> = ({
  modalProps,
  formProps,
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
        <Input placeholder="Enter type (e.g., SIN, Baneto)" variant="filled" />
      </Form.Item>

      <Form.Item
        name="expires_at"
        label="Expiration Date"
        rules={[{ required: true, message: 'Please select expiration date' }]}
        tooltip="Format: DD.MM.YYYY"
        getValueProps={(value) => ({ value: toDayjsValue(value) })}
      >
        <DatePicker
          style={{ width: '100%' }}
          format="DD.MM.YYYY"
          placeholder="DD.MM.YYYY"
          variant="filled"
        />
      </Form.Item>
    </Form>
  </AppModal>
);

interface AddBotModalProps {
  open: boolean;
  bots: BotsMap;
  form: FormInstance<AddBotFormValues>;
  submitting: boolean;
  onCancel: () => void;
  onSave: (values: AddBotFormValues) => Promise<void>;
}

export const AddBotModal: React.FC<AddBotModalProps> = ({
  open,
  bots,
  form,
  submitting,
  onCancel,
  onSave,
}) => (
  <AppModal
    title="Add Bot to License"
    open={open}
    onOk={() => form.submit()}
    onCancel={onCancel}
    okText="Add Bot"
    width={400}
    confirmLoading={submitting}
    okButtonProps={{ disabled: submitting }}
  >
    <Form form={form} layout="vertical" onFinish={(values) => void onSave(values)}>
      <Form.Item
        name="bot_id"
        label="Select Bot"
        rules={[{ required: true, message: 'Please select a bot' }]}
      >
        <Select placeholder="Select bot from list" variant="filled">
          {Object.entries(bots).map(([id, bot]) => {
            const characterName = bot.character?.name;
            const vmName = bot.vm?.name;
            const botName = bot.name || id.substring(0, 8);
            const displayName = characterName || botName;
            const subText = vmName ? ` (${vmName})` : '';
            return (
              <Option key={id} value={id}>
                {displayName}
                {subText} - {id.substring(0, 8)}...
              </Option>
            );
          })}
        </Select>
      </Form.Item>
    </Form>
  </AppModal>
);
