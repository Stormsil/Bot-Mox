import { financeOperationCreateSchema } from '@botmox/api-contract';
import {
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import type {
  FinanceOperation,
  FinanceOperationFormData,
  FinanceOperationType,
} from '../../entities/finance/model/types';

const { Text } = Typography;
const { TextArea } = Input;

interface TransactionFormProps {
  visible: boolean;
  operation: FinanceOperation | null;
  onCancel: () => void;
  onSubmit: (data: FinanceOperationFormData) => Promise<void>;
  loading?: boolean;
}

const INCOME_CATEGORIES = [
  { value: 'sale', label: 'Gold Sale' },
  { value: 'other', label: 'Other Income' },
] as const;

const EXPENSE_CATEGORIES = [
  { value: 'subscription_game', label: 'Game Subscription' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'bot_license', label: 'Bot license' },
  { value: 'other', label: 'Other Expense' },
] as const;

const transactionFormSchema = financeOperationCreateSchema.superRefine((values, ctx) => {
  if (values.type === 'income' && values.category !== 'sale') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category'],
      message: 'Income transactions are recorded as Gold Sale',
    });
  }

  if (values.category === 'sale') {
    if (!values.project_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['project_id'],
        message: 'Please select project',
      });
    }

    if (values.gold_amount == null || Number.isNaN(Number(values.gold_amount))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gold_amount'],
        message: 'Please enter gold amount',
      });
    }

    if (values.gold_price_at_time == null || Number.isNaN(Number(values.gold_price_at_time))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gold_price_at_time'],
        message: 'Please enter gold price',
      });
    }
  }

  if (
    values.category !== 'sale' &&
    (values.amount == null || Number.isNaN(Number(values.amount)))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['amount'],
      message: 'Please enter amount',
    });
  }
});

type TransactionFormValues = z.input<typeof transactionFormSchema>;

function getCreateDefaults(): TransactionFormValues {
  return {
    type: 'expense',
    category: 'other',
    amount: 0,
    currency: 'USD',
    date: Date.now(),
    description: '',
    bot_id: null,
    project_id: null,
    gold_amount: null,
    gold_price_at_time: null,
  };
}

function getEditDefaults(operation: FinanceOperation): TransactionFormValues {
  return {
    id: operation.id,
    type: operation.type,
    category: operation.category,
    amount: operation.amount,
    currency: operation.currency,
    date: operation.date,
    description: operation.description || '',
    bot_id: operation.bot_id,
    project_id: operation.project_id,
    gold_amount: operation.gold_amount ?? null,
    gold_price_at_time: operation.gold_price_at_time ?? null,
  };
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  visible,
  operation,
  onCancel,
  onSubmit,
  loading = false,
}) => {
  const { token } = theme.useToken();
  const isEdit = !!operation;
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const transactionType =
    (Form.useWatch('type', form) as TransactionFormValues['type'] | undefined) ?? 'expense';
  const selectedCategory =
    (Form.useWatch('category', form) as TransactionFormValues['category'] | undefined) ?? '';
  const goldAmount = Number((Form.useWatch('gold_amount', form) as number | null | undefined) ?? 0);
  const goldPrice = Number(
    (Form.useWatch('gold_price_at_time', form) as number | null | undefined) ?? 0,
  );

  const isGoldSale = selectedCategory === 'sale';
  const calculatedAmount = goldAmount * (goldPrice / 1000);

  const categories = useMemo(
    () => (transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [transactionType],
  );

  useEffect(() => {
    if (!visible) return;
    const defaults = operation ? getEditDefaults(operation) : getCreateDefaults();
    form.setFieldsValue({
      ...defaults,
      date: defaults.date,
    } as Record<string, unknown>);
    form.setFields([]);
  }, [visible, operation, form]);

  const submitForm = async () => {
    try {
      setSubmitting(true);
      const values = (await form.validateFields()) as TransactionFormValues & { date: unknown };
      const normalizedValues: TransactionFormValues = {
        ...getCreateDefaults(),
        ...values,
        date: dayjs.isDayjs(values.date) ? values.date.valueOf() : Number(values.date),
      };

      const parsed = transactionFormSchema.parse(normalizedValues as unknown);

      const formData: FinanceOperationFormData = {
        type: parsed.type as FinanceOperationType,
        category: parsed.category as FinanceOperationFormData['category'],
        bot_id: null,
        project_id: (parsed.project_id ?? null) as FinanceOperationFormData['project_id'],
        description: parsed.description ?? '',
        amount: parsed.category === 'sale' ? calculatedAmount : parsed.amount,
        currency: 'USD',
        gold_price_at_time: parsed.category === 'sale' ? (parsed.gold_price_at_time ?? null) : null,
        gold_amount:
          parsed.category === 'sale'
            ? ((parsed.gold_amount ?? undefined) as FinanceOperationFormData['gold_amount'])
            : undefined,
        date: dayjs(parsed.date).format('YYYY-MM-DD HH:mm:ss'),
      };

      await onSubmit(formData);
      form.setFieldsValue(getCreateDefaults() as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof z.ZodError) {
        form.setFields(
          error.issues.map((issue) => ({
            name: issue.path,
            errors: [issue.message],
          })),
        );
        return;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error &&
        Array.isArray((error as { errorFields?: unknown[] }).errorFields)
      ) {
        return;
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      open={visible}
      onOk={() => {
        void submitForm();
      }}
      onCancel={onCancel}
      confirmLoading={loading || submitting}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: 'expense', currency: 'USD' }}
        preserve
      >
        <Form.Item name="type" label="Transaction Type">
          <Radio.Group
            disabled={isEdit}
            buttonStyle="solid"
            style={{ display: 'flex', gap: 8 }}
            onChange={(e) => {
              const nextType = e.target.value as FinanceOperationType;
              if (nextType === 'income') {
                form.setFieldsValue({
                  type: nextType,
                  category: 'sale',
                  project_id: null,
                } as Record<string, unknown>);
              } else {
                form.setFieldsValue({
                  type: nextType,
                  category: 'other',
                  project_id: null,
                } as Record<string, unknown>);
              }
            }}
          >
            <Radio.Button value="income">Income</Radio.Button>
            <Radio.Button value="expense">Expense</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {transactionType === 'expense' && (
          <Form.Item name="category" label="Category">
            <Select
              placeholder="Select category"
              disabled={isEdit}
              options={categories.map((cat) => ({ value: cat.value, label: cat.label }))}
            />
          </Form.Item>
        )}

        {isGoldSale && (
          <Form.Item name="project_id" label="Project">
            <Select
              placeholder="Select project"
              options={[
                { value: 'wow_tbc', label: 'WoW TBC Classic' },
                { value: 'wow_midnight', label: 'WoW Midnight' },
              ]}
            />
          </Form.Item>
        )}

        {isGoldSale && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 16 }}>
              Gold Sale Details
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item name="gold_amount" label="Gold Amount (g)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="Enter gold amount" />
              </Form.Item>

              <Form.Item name="gold_price_at_time" label="Gold Price (per 1000g)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  placeholder="Enter gold price"
                  prefix="$"
                />
              </Form.Item>

              <div
                style={{
                  background: token.colorFillTertiary,
                  padding: '12px 16px',
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text type="secondary">Calculated Amount: </Text>
                <Text strong style={{ color: token.colorSuccess, fontSize: token.fontSizeLG }}>
                  ${calculatedAmount.toFixed(2)}
                </Text>
              </div>
            </Space>
            <Divider style={{ margin: '16px 0' }} />
          </>
        )}

        {!isGoldSale && (
          <Form.Item name="amount" label="Amount (USD)">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              placeholder="Enter amount"
              prefix="$"
            />
          </Form.Item>
        )}

        <Form.Item name="date" label="Date & Time" tooltip="Format: DD.MM.YYYY HH:mm">
          <DatePicker
            style={{ width: '100%' }}
            format="DD.MM.YYYY HH:mm"
            showTime={{ format: 'HH:mm' }}
            value={(() => {
              const current = form.getFieldValue('date');
              if (dayjs.isDayjs(current)) return current;
              if (typeof current === 'number') return dayjs(current);
              return null;
            })()}
            onChange={(date) => {
              form.setFieldValue('date', date ? date.valueOf() : Date.now());
            }}
          />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea rows={2} placeholder="Enter transaction description (optional)" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
