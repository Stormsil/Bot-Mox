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
} from 'antd';
import type { FinanceOperation, FinanceOperationFormData, FinanceOperationType } from '../../types';
import { formatTimestampToDate } from '../../services/financeService';
import dayjs from 'dayjs';
import './TransactionForm.css';

const { Text } = Typography;
const { Option } = Select;

interface TransactionFormProps {
  visible: boolean;
  operation: FinanceOperation | null;
  onCancel: () => void;
  onSubmit: (data: FinanceOperationFormData) => Promise<void>;
  loading?: boolean;
  goldPriceTBC: number;
  goldPriceMidnight: number;
}

// Категории для доходов
const INCOME_CATEGORIES = [
  { value: 'sale', label: 'Gold Sale' },
  { value: 'other', label: 'Other Income' },
];

// Категории для расходов
const EXPENSE_CATEGORIES = [
  { value: 'subscription_bot', label: 'Bot Subscription' },
  { value: 'subscription_game', label: 'Game Subscription' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'license', label: 'License' },
  { value: 'other', label: 'Other Expense' },
];

export const TransactionForm: React.FC<TransactionFormProps> = ({
  visible,
  operation,
  onCancel,
  onSubmit,
  loading = false,
  goldPriceTBC,
  goldPriceMidnight,
}) => {
  const [form] = Form.useForm();
  const [transactionType, setTransactionType] = useState<FinanceOperationType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [goldAmount, setGoldAmount] = useState<number>(0);
  const [goldPrice, setGoldPrice] = useState<number>(0);

  const isEdit = !!operation;
  const isGoldSale = selectedCategory === 'sale';

  // Получаем текущую цену золота в зависимости от проекта
  const currentGoldPrice = selectedProject === 'wow_midnight' ? goldPriceMidnight : goldPriceTBC;

  // Рассчитываем сумму для продажи золота
  const calculatedAmount = goldAmount * (goldPrice / 1000);

  // Инициализация формы при открытии
  useEffect(() => {
    if (visible) {
      if (operation) {
        // Режим редактирования
        setTransactionType(operation.type);
        setSelectedCategory(operation.category);
        setSelectedProject(operation.project_id || '');
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
        setSelectedProject('');
        setGoldAmount(0);
        setGoldPrice(0);

        form.resetFields();
        form.setFieldsValue({
          type: 'expense',
          currency: 'USD',
          date: dayjs(),
        });
      }
    }
  }, [visible, operation, form]);

  // Обновляем цену золота при изменении проекта
  useEffect(() => {
    if (isGoldSale && selectedProject) {
      setGoldPrice(currentGoldPrice);
      form.setFieldsValue({ gold_price_at_time: currentGoldPrice });
    }
  }, [selectedProject, isGoldSale, currentGoldPrice, form]);

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
        date: values.date.format('YYYY-MM-DD'),
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
    setSelectedCategory('');
    form.setFieldsValue({ category: undefined });
  };

  // Обработка изменения категории
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (category === 'sale') {
      // Для продажи золота устанавливаем цену по умолчанию
      setGoldPrice(currentGoldPrice);
      form.setFieldsValue({ gold_price_at_time: currentGoldPrice });
    }
  };

  // Обработка изменения проекта
  const handleProjectChange = (project: string) => {
    setSelectedProject(project);
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
      title={isEdit ? 'Edit Transaction' : 'Add Transaction'}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      width={600}
      className="transaction-form-modal"
    >
      <Form
        form={form}
        layout="vertical"
        className="transaction-form"
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
          >
            <Radio.Button value="income">Income</Radio.Button>
            <Radio.Button value="expense">Expense</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* Категория */}
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

        {/* Проект (для продажи золота) */}
        {isGoldSale && (
          <Form.Item
            name="project_id"
            label="Project"
            rules={[{ required: true, message: 'Please select project' }]}
          >
            <Select placeholder="Select project" onChange={handleProjectChange}>
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
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  placeholder="Enter gold amount"
                  onChange={handleGoldAmountChange}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => {
                    const parsed = value!.replace(/\s?|(,*)/g, '');
                    return parsed ? Number(parsed) : 0;
                  }}
                />
              </Form.Item>

              <Form.Item
                name="gold_price_at_time"
                label={`Gold Price (per 1000g) - Current: $${currentGoldPrice.toFixed(2)}`}
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

              <div className="calculated-amount">
                <Text type="secondary">Calculated Amount: </Text>
                <Text strong className="amount-value">
                  ${calculatedAmount.toFixed(2)}
                </Text>
              </div>
            </Space>
            <Divider style={{ margin: '16px 0' }} />
          </>
        )}

        {/* Описание */}
        <Form.Item
          name="description"
          label="Description"
          rules={[{ required: true, message: 'Please enter description' }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="Enter transaction description"
          />
        </Form.Item>

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

        {/* Дата */}
        <Form.Item
          name="date"
          label="Date"
          rules={[{ required: true, message: 'Please select date' }]}
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
