import { financeOperationCreateSchema } from '@botmox/api-contract';
import { zodResolver } from '@hookform/resolvers/zod';
import { Divider, Form, Radio, Space, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import type {
  FinanceOperation,
  FinanceOperationFormData,
  FinanceOperationType,
} from '../../entities/finance/model/types';
import {
  RHFDatePicker,
  RHFFormItem,
  RHFInputNumber,
  RHFSelect,
  RHFTextArea,
} from '../../shared/ui/form';
import { ThemeModal } from '../ui';

const { Text } = Typography;

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

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: getCreateDefaults(),
  });

  const transactionType = useWatch({ control, name: 'type' }) ?? 'expense';
  const selectedCategory = useWatch({ control, name: 'category' }) ?? '';
  const goldAmount = Number(useWatch({ control, name: 'gold_amount' }) ?? 0);
  const goldPrice = Number(useWatch({ control, name: 'gold_price_at_time' }) ?? 0);

  const isGoldSale = selectedCategory === 'sale';
  const calculatedAmount = goldAmount * (goldPrice / 1000);

  const categories = useMemo(
    () => (transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    [transactionType],
  );

  useEffect(() => {
    if (!visible) return;
    reset(operation ? getEditDefaults(operation) : getCreateDefaults());
  }, [visible, operation, reset]);

  const submitForm = handleSubmit(async (values) => {
    const formData: FinanceOperationFormData = {
      type: values.type as FinanceOperationType,
      category: values.category as FinanceOperationFormData['category'],
      bot_id: null,
      project_id: (values.project_id ?? null) as FinanceOperationFormData['project_id'],
      description: values.description ?? '',
      amount: values.category === 'sale' ? calculatedAmount : values.amount,
      currency: 'USD',
      gold_price_at_time: values.category === 'sale' ? (values.gold_price_at_time ?? null) : null,
      gold_amount:
        values.category === 'sale'
          ? ((values.gold_amount ?? undefined) as FinanceOperationFormData['gold_amount'])
          : undefined,
      date: dayjs(values.date).format('YYYY-MM-DD HH:mm:ss'),
    };

    await onSubmit(formData);
    reset(getCreateDefaults());
  });

  return (
    <ThemeModal
      title={
        <span style={{ color: token.colorText }}>
          {isEdit ? 'Edit Transaction' : 'Add Transaction'}
        </span>
      }
      open={visible}
      onOk={() => {
        void submitForm();
      }}
      onCancel={onCancel}
      confirmLoading={loading || isSubmitting}
      width={600}
    >
      <Form layout="vertical" initialValues={{ type: 'expense', currency: 'USD' }}>
        <RHFFormItem<TransactionFormValues, 'type'>
          control={control}
          name="type"
          label="Transaction Type"
        >
          {({ field }) => (
            <Radio.Group
              value={field.value}
              disabled={isEdit}
              buttonStyle="solid"
              style={{ display: 'flex', gap: 8 }}
              onChange={(e) => {
                const nextType = e.target.value as FinanceOperationType;
                field.onChange(nextType);
                if (nextType === 'income') {
                  setValue('category', 'sale', { shouldDirty: true, shouldValidate: true });
                  setValue('project_id', null, { shouldDirty: true, shouldValidate: true });
                } else {
                  setValue('category', 'other', { shouldDirty: true, shouldValidate: true });
                  setValue('project_id', null, { shouldDirty: true, shouldValidate: false });
                }
              }}
            >
              <Radio.Button value="income">Income</Radio.Button>
              <Radio.Button value="expense">Expense</Radio.Button>
            </Radio.Group>
          )}
        </RHFFormItem>

        {transactionType === 'expense' && (
          <RHFSelect<TransactionFormValues, 'category'>
            control={control}
            name="category"
            label="Category"
            placeholder="Select category"
            disabled={isEdit}
            options={categories.map((cat) => ({ value: cat.value, label: cat.label }))}
          />
        )}

        {isGoldSale && (
          <RHFSelect<TransactionFormValues, 'project_id'>
            control={control}
            name="project_id"
            label="Project"
            placeholder="Select project"
            options={[
              { value: 'wow_tbc', label: 'WoW TBC Classic' },
              { value: 'wow_midnight', label: 'WoW Midnight' },
            ]}
          />
        )}

        {isGoldSale && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 16 }}>
              Gold Sale Details
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <RHFInputNumber<TransactionFormValues, 'gold_amount'>
                control={control}
                name="gold_amount"
                label="Gold Amount (g)"
                style={{ width: '100%' }}
                min={0}
                placeholder="Enter gold amount"
              />

              <RHFInputNumber<TransactionFormValues, 'gold_price_at_time'>
                control={control}
                name="gold_price_at_time"
                label="Gold Price (per 1000g)"
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                placeholder="Enter gold price"
                prefix="$"
              />

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
          <RHFInputNumber<TransactionFormValues, 'amount'>
            control={control}
            name="amount"
            label="Amount (USD)"
            style={{ width: '100%' }}
            min={0}
            step={0.01}
            placeholder="Enter amount"
            prefix="$"
          />
        )}

        <RHFDatePicker<TransactionFormValues, 'date', number>
          control={control}
          name="date"
          label="Date & Time"
          style={{ width: '100%' }}
          format="DD.MM.YYYY HH:mm"
          showTime={{ format: 'HH:mm' }}
          toFormValue={(date) => (date ? date.valueOf() : Date.now())}
          fromFormValue={(value) => (typeof value === 'number' ? dayjs(value) : null)}
        />

        <RHFTextArea<TransactionFormValues, 'description'>
          control={control}
          name="description"
          label="Description"
          rows={2}
          placeholder="Enter transaction description (optional)"
        />
      </Form>
    </ThemeModal>
  );
};
