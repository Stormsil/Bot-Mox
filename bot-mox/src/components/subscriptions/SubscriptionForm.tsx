import React, { useState, useEffect, useMemo } from 'react';
import {
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Alert,
} from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import type { SubscriptionFormData, SubscriptionWithDetails } from '../../types';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import './SubscriptionForm.css';

const { Option } = Select;

// Interface for bot in dropdown
interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
  vmName?: string;
}

interface SubscriptionFormProps {
  // Edit mode
  editingSubscription?: SubscriptionWithDetails | null;
  // Preset bot_id (when form is opened from bot page)
  presetBotId?: string;
  // List of bots for selection
  bots: BotOption[];
  // Callback on save
  onSave: (data: SubscriptionFormData) => void;
  // Callback on cancel
  onCancel?: () => void;
  // Loading state
  loading?: boolean;
}

interface SubscriptionFormValues {
  bot_id?: string;
  expires_at: Dayjs;
}

/**
 * Subscription creation/editing form
 * Date is entered in DD.MM.YYYY format
 */
export const SubscriptionForm: React.FC<SubscriptionFormProps> = ({
  editingSubscription,
  presetBotId,
  bots,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [dateError, setDateError] = useState<string | null>(null);

  const isEditing = !!editingSubscription;
  const isBotPreset = !!presetBotId;

  // Filter bots - exclude banned ones
  const availableBots = useMemo(() => {
    return bots.filter((bot) => bot.status !== 'banned');
  }, [bots]);

  // Initialize form when editing or when modal opens
  useEffect(() => {
    if (editingSubscription) {
      form.setFieldsValue({
        bot_id: editingSubscription.bot_id,
        expires_at: dayjs(editingSubscription.expires_at),
      });
    } else {
      // Default values for new subscription
      // Reset form first to clear any previous values
      form.resetFields();
      form.setFieldsValue({
        bot_id: presetBotId || undefined,
        expires_at: dayjs().add(30, 'days'), // Default +30 days
      });
    }
  }, [editingSubscription, presetBotId, form]);

  // Form submission handler
  const handleSubmit = (values: SubscriptionFormValues) => {
    setDateError(null);

    // Check date
    const expiresAt = values.expires_at;
    if (!expiresAt || !expiresAt.isValid()) {
      setDateError('Please select a valid expiration date');
      return;
    }

    // Use presetBotId if values.bot_id is not set (when form is opened from bot page)
    const botId = values.bot_id || presetBotId;
    if (!botId) {
      setDateError('Please select a bot');
      return;
    }

    // Format date to DD.MM.YYYY
    const formattedDate = expiresAt.format('DD.MM.YYYY');

    const formData: SubscriptionFormData = {
      bot_id: botId,
      type: 'wow',
      expires_at: formattedDate,
    };

    onSave(formData);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className="subscription-form"
    >
      {dateError && (
        <Alert
          message={dateError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setDateError(null)}
        />
      )}

      {/* Bot selection (hidden if bot_id is preset) */}
      {!isBotPreset && (
        <Form.Item
          name="bot_id"
          label="Bot"
          rules={[{ required: true, message: 'Please select a bot' }]}
        >
          <Select
            placeholder="Select bot"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
            disabled={loading}
          >
            {availableBots.map((bot) => {
              // Формат: CharacterName (VM-Name) - shortUUID
              const vmName = bot.vmName || bot.name || 'Unknown';
              const characterName = bot.character || 'Unknown';
              const displayLabel = `${characterName} (${vmName}) - ${bot.id}`;

              return (
                <Option key={bot.id} value={bot.id}>
                  {displayLabel}
                </Option>
              );
            })}
          </Select>
        </Form.Item>
      )}

      {/* Expiration date */}
      <Form.Item
        name="expires_at"
        label="Expiration Date"
        rules={[{ required: true, message: 'Please select an expiration date' }]}
        tooltip="Format: DD.MM.YYYY"
      >
        <DatePicker
          format="DD.MM.YYYY"
          style={{ width: '100%' }}
          placeholder="DD.MM.YYYY"
          disabled={loading}
          disabledDate={(current) => {
            // Disallow past dates
            return current && current < dayjs().startOf('day');
          }}
        />
      </Form.Item>

      {/* Buttons */}
      <Form.Item>
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            icon={isEditing ? <EditOutlined /> : <PlusOutlined />}
            loading={loading}
          >
            {isEditing ? 'Save Changes' : 'Add Subscription'}
          </Button>
          {onCancel && (
            <Button onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
        </Space>
      </Form.Item>
    </Form>
  );
};
