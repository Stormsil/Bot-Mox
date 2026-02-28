import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Form, type FormProps, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type {
  SubscriptionFormData,
  SubscriptionWithDetails,
} from '../../entities/resources/model/types';
import styles from './SubscriptionForm.module.css';

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
  editingSubscription?: SubscriptionWithDetails | null;
  presetBotId?: string;
  bots: BotOption[];
  formProps: FormProps;
  onCancel?: () => void;
}

interface SubscriptionFormValues {
  bot_id?: string;
  expires_at: Dayjs;
}

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

/**
 * Subscription creation/editing form
 * Date is entered in DD.MM.YYYY format
 */
export const SubscriptionForm: React.FC<SubscriptionFormProps> = ({
  editingSubscription,
  presetBotId,
  bots,
  formProps,
  onCancel,
}) => {
  const [fallbackForm] = Form.useForm<SubscriptionFormValues>();
  const form = formProps.form ?? fallbackForm;
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
  const handleSubmit = async (values: SubscriptionFormValues) => {
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

    if (!formProps.onFinish) {
      return;
    }

    await formProps.onFinish(formData as never);
  };

  return (
    <Form
      {...formProps}
      form={form}
      layout="vertical"
      onFinish={(values) => {
        void handleSubmit(values);
      }}
      className={styles.root}
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
          <Select placeholder="Select bot" showSearch optionFilterProp="label">
            {availableBots.map((bot) => {
              const vmName = bot.vmName || bot.name || 'Unknown';
              const characterName = bot.character || 'Unknown';

              // Search string. Keep it user-facing (no IDs).
              const searchLabel = `${characterName} ${vmName} ${bot.account_email ?? ''}`.trim();

              return (
                <Option key={bot.id} value={bot.id} label={searchLabel}>
                  <div className={styles.botOption}>
                    <div className={styles.botOptionTitle}>{characterName}</div>
                    <div className={styles.botOptionMeta}>{vmName}</div>
                  </div>
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
        getValueProps={(value) => ({ value: toDayjsValue(value) })}
      >
        <DatePicker
          format="DD.MM.YYYY"
          style={{ width: '100%' }}
          placeholder="DD.MM.YYYY"
          disabledDate={(current) => {
            // Disallow past dates
            return current && current < dayjs().startOf('day');
          }}
        />
      </Form.Item>

      {/* Buttons */}
      <Form.Item>
        <div className={styles.actions}>
          <Button
            type="primary"
            htmlType="submit"
            icon={isEditing ? <EditOutlined /> : <PlusOutlined />}
          >
            {isEditing ? 'Save Changes' : 'Add Subscription'}
          </Button>
          {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        </div>
      </Form.Item>
    </Form>
  );
};
