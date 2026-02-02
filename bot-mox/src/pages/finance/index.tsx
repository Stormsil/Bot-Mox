import React, { useState, useEffect } from 'react';
import { ContentPanel } from '../../components/layout/ContentPanel';
import { FinanceSummary, FinanceTransactions, TransactionForm } from '../../components/finance';
import { useFinance } from '../../hooks/useFinance';
import type { FinanceOperation, FinanceOperationFormData } from '../../types';
import './FinancePage.css';

type FinanceTab = 'summary' | 'transactions';

export const FinancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FinanceTab>('summary');
  const [formVisible, setFormVisible] = useState(false);
  const [editingOperation, setEditingOperation] = useState<FinanceOperation | null>(null);
  const [goldPrices, setGoldPrices] = useState({ tbc: 12.5, midnight: 8.5 });

  const {
    operations,
    summary,
    incomeBreakdown,
    expenseBreakdown,
    timeSeriesData,
    loading,
    addOperation,
    updateOperation,
    deleteOperation,
    getGoldPrice,
  } = useFinance({ days: 30 });

  // Загрузка цен на золото
  useEffect(() => {
    const loadGoldPrices = async () => {
      const tbcPrice = await getGoldPrice('wow_tbc');
      const midnightPrice = await getGoldPrice('wow_midnight');
      setGoldPrices({ tbc: tbcPrice, midnight: midnightPrice });
    };
    loadGoldPrices();
  }, [getGoldPrice]);

  // Обработка добавления транзакции
  const handleAdd = () => {
    setEditingOperation(null);
    setFormVisible(true);
  };

  // Обработка редактирования транзакции
  const handleEdit = (operation: FinanceOperation) => {
    setEditingOperation(operation);
    setFormVisible(true);
  };

  // Обработка удаления транзакции
  const handleDelete = async (id: string) => {
    await deleteOperation(id);
  };

  // Обработка отправки формы
  const handleFormSubmit = async (data: FinanceOperationFormData) => {
    if (editingOperation) {
      await updateOperation(editingOperation.id, data);
    } else {
      await addOperation(data);
    }
    setFormVisible(false);
    setEditingOperation(null);
  };

  // Обработка закрытия формы
  const handleFormCancel = () => {
    setFormVisible(false);
    setEditingOperation(null);
  };

  // Рендер содержимого вкладки
  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <FinanceSummary
            summary={summary}
            incomeBreakdown={incomeBreakdown}
            expenseBreakdown={expenseBreakdown}
            timeSeriesData={timeSeriesData}
            loading={loading}
          />
        );
      case 'transactions':
        return (
          <FinanceTransactions
            operations={operations}
            loading={loading}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="finance-page">
      <ContentPanel
        type="finance"
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as FinanceTab)}
      >
        {renderTabContent()}
      </ContentPanel>

      <TransactionForm
        visible={formVisible}
        operation={editingOperation}
        onCancel={handleFormCancel}
        onSubmit={handleFormSubmit}
        loading={loading}
        goldPriceTBC={goldPrices.tbc}
        goldPriceMidnight={goldPrices.midnight}
      />
    </div>
  );
};
