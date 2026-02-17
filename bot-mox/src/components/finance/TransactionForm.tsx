import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Radio,
  Space,
  Typography,
  Divider,
  theme,
} from 'antd';
import type { FinanceOperation, FinanceOperationFormData, FinanceOperationType } from '../../types';
import { formatTimestampToDate } from '../../services/financeService';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface TransactionFormProps {
  visible: boolean;
  operation: FinanceOperation | null;
  onCancel: () => void;
  onSubmit: (data: FinanceOperationFormData) => Promise<void>;
  loading?: boolean;
  // Note: gold prices are now entered manually per transaction
}

// Категории для доходов
const INCOME_CATEGORIES = [
  { value: 'sale', label: 'Gold Sale' },
  { value: 'other', label: 'Other Income' },
];

// Категории для расходов
const EXPENSE_CATEGORIES = [
  { value: 'subscription_game', label: 'Game Subscription' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'bot_license', label: 'Bot license' },
  { value: 'other', label: 'Other Expense' },
];

export const TransactionForm: React.FC<TransactionFormProps> = ({
  visible,
  operation,
  onCancel,
  onSubmit,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [transactionType, setTransactionType] = useState<FinanceOperationType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [goldAmount, setGoldAmount] = useState<number>(0);
  const [goldPrice, setGoldPrice] = useState<number>(0);
  const { token } = theme.useToken();

  const isEdit = !!operation;
  const isGoldSale = selectedCategory === 'sale';

  // Рассчитываем сумму для продажи золота
  const calculatedAmount = goldAmount * (goldPrice / 1000);

  // Инициализация формы при открытии
  useEffect(() => {
    if (!visible) return;

    const frameId = window.requestAnimationFrame(() => {
      if (operation) {
        // Режим редактирования
        setTransactionType(operation.type);
        setSelectedCategory(operation.category);
        setGoldAmount(operation.gold_amount || 0);
        setGoldPrice(operation.gold_price_at_time || 0);

        form.setFieldsValue({
          type: operation.type,
          category: operation.category,
          project_id: operation.project_id,
          description: operation.description,
          amount: operation.amount,
          currency: operation.currency,
          gold_amount: operation.gold_amount,
          gold_price_at_time: operation.gold_price_at_time,
          date: dayjs(formatTimestampToDate(operation.date)),
        });
      } else {
        // Режим создания
        setTransactionType('expense');
        setSelectedCategory('');
        setGoldAmount(0);
        setGoldPrice(0);

        form.resetFields();
        form.setFieldsValue({
          type: 'expense',
          currency: 'USD',
          date: dayjs(),
          category: undefined,
        });
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [visible, operation, form]);

  // Note: Gold price is now entered manually per transaction
  // No automatic price updates based on project selection

  // Обработка отправки формы
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const formData: FinanceOperationFormData = {
        type: values.type,
        category: values.category,
        bot_id: null, // Привязка к боту не нужна
        project_id: values.project_id || null,
        description: values.description,
        amount: isGoldSale ? calculatedAmount : values.amount,
        currency: 'USD',
        gold_price_at_time: isGoldSale ? values.gold_price_at_time : null,
        gold_amount: isGoldSale ? values.gold_amount : undefined,
        date: values.date.format('YYYY-MM-DD HH:mm:ss'),
      };

      await onSubmit(formData);
      form.resetFields();
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  // Обработка изменения типа транзакции
  const handleTypeChange = (type: FinanceOperationType) => {
    setTransactionType(type);
    if (type === 'income') {
      // Для доходов всегда продажа золота
      setSelectedCategory('sale');
      form.setFieldsValue({ 
        category: 'sale',
        project_id: undefined,
      });
    } else {
      setSelectedCategory('');
      form.setFieldsValue({ category: undefined });
    }
  };

  // Обработка изменения категории
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // Note: Price is now entered manually, no default value from project
  };

  // Обработка изменения количества золота
  const handleGoldAmountChange = (value: number | null) => {
    setGoldAmount(value || 0);
  };

  // Обработка изменения цены золота
  const handleGoldPriceChange = (value: number | null) => {
    setGoldPrice(value || 0);
  };

  // Получаем список категорий в зависимости от типа
  const categories = transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Modal
      title={
        <span style={{ color: token.colorText }}>
          {isEdit ? 'Edit Transaction' : 'Add Transaction'}
        </span>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      width={600}
      styles={{
        content: {
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
        },
        header: {
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
        footer: {
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: 'expense', currency: 'USD' }}
      >
        {/* Тип транзакции */}
        <Form.Item
          name="type"
          label="Transaction Type"
          rules={[{ required: true, message: 'Please select type' }]}
        >
          <Radio.Group
            onChange={(e) => handleTypeChange(e.target.value)}
            disabled={isEdit}
            buttonStyle="solid"
            style={{ display: 'flex', gap: 8 }}
          >
            <Radio.Button value="income">Income</Radio.Button>
            <Radio.Button value="expense">Expense</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* Категория (только для расходов) */}
        {transactionType === 'expense' && (
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select
              placeholder="Select category"
              onChange={handleCategoryChange}
              disabled={isEdit}
            >
              {categories.map((cat) => (
                <Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {/* Проект (для продажи золота) */}
        {isGoldSale && (
          <Form.Item
            name="project_id"
            label="Project"
            rules={[{ required: true, message: 'Please select project' }]}
          >
            <Select placeholder="Select project">
              <Option value="wow_tbc">WoW TBC Classic</Option>
              <Option value="wow_midnight">WoW Midnight</Option>
            </Select>
          </Form.Item>
        )}

        {/* Поля для продажи золота */}
        {isGoldSale && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 16 }}>
              Gold Sale Details
            </Text>

            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Form.Item
                name="gold_amount"
                label="Gold Amount (g)"
                rules={[{ required: true, message: 'Please enter gold amount' }]}
              >
                <InputNumber<number>
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="Enter gold amount"
                  value={goldAmount}
                  onChange={handleGoldAmountChange}
                />
              </Form.Item>

              <Form.Item
                name="gold_price_at_time"
                label="Gold Price (per 1000g)"
                rules={[{ required: true, message: 'Please enter gold price' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  placeholder="Enter gold price"
                  onChange={handleGoldPriceChange}
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

        {/* Сумма (только для не-продаж) */}
        {!isGoldSale && (
          <Form.Item
            name="amount"
            label="Amount (USD)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.01}
              placeholder="Enter amount"
              prefix="$"
            />
          </Form.Item>
        )}

        {/* Дата и время */}
        <Form.Item
          name="date"
          label="Date & Time"
          rules={[{ required: true, message: 'Please select date and time' }]}
        >
          <DatePicker 
            style={{ width: '100%' }} 
            format="DD.MM.YYYY HH:mm"
            showTime={{ format: 'HH:mm' }}
          />
        </Form.Item>

        {/* Описание (опционально) */}
        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea
            rows={2}
            placeholder="Enter transaction description (optional)"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
