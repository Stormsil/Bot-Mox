import React from 'react';
import { AutoComplete, DatePicker, Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { LicenseWithBots } from '../../../types';
import type { BotsMap, AddBotFormValues, LicenseFormValues } from './types';

const { Option } = Select;

interface LicenseEditorModalProps {
  open: boolean;
  editingLicense: LicenseWithBots | null;
  licenses: LicenseWithBots[];
  form: FormInstance<LicenseFormValues>;
  onCancel: () => void;
  onSave: (values: LicenseFormValues) => Promise<void>;
}

export const LicenseEditorModal: React.FC<LicenseEditorModalProps> = ({
  open,
  editingLicense,
  licenses,
  form,
  onCancel,
  onSave,
}) => (
  <Modal
    title={editingLicense ? 'Edit License' : 'Add License'}
    open={open}
    onOk={() => form.submit()}
    onCancel={onCancel}
    okText={editingLicense ? 'Update' : 'Create'}
    width={500}
  >
    <Form form={form} layout="vertical" onFinish={(values) => void onSave(values)}>
      <Form.Item
        name="key"
        label="License Key"
        rules={[{ required: true, message: 'Please enter license key' }]}
      >
        <Input
          placeholder="Enter license key (e.g., SIN-ABC123-DEF456)"
          variant="filled"
        />
      </Form.Item>

      <Form.Item
        name="type"
        label="Type"
        rules={[{ required: true, message: 'Please enter license type' }]}
      >
        <AutoComplete
          placeholder="Enter type (e.g., SIN, Baneto)"
          variant="filled"
          options={Array.from(new Set(licenses.map((license) => license.type).filter(Boolean))).map((type) => ({
            value: type,
            label: type,
          }))}
          filterOption={(inputValue, option) =>
            option?.value?.toLowerCase().includes(inputValue.toLowerCase()) ?? false
          }
        />
      </Form.Item>

      <Form.Item
        name="expires_at"
        label="Expiration Date"
        rules={[{ required: true, message: 'Please select expiration date' }]}
        tooltip="Format: DD.MM.YYYY"
      >
        <DatePicker
          style={{ width: '100%' }}
          format="DD.MM.YYYY"
          placeholder="DD.MM.YYYY"
          variant="filled"
        />
      </Form.Item>
    </Form>
  </Modal>
);

interface AddBotModalProps {
  open: boolean;
  bots: BotsMap;
  form: FormInstance<AddBotFormValues>;
  onCancel: () => void;
  onSave: (values: AddBotFormValues) => Promise<void>;
}

export const AddBotModal: React.FC<AddBotModalProps> = ({ open, bots, form, onCancel, onSave }) => (
  <Modal
    title="Add Bot to License"
    open={open}
    onOk={() => form.submit()}
    onCancel={onCancel}
    okText="Add Bot"
    width={400}
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
  </Modal>
);
