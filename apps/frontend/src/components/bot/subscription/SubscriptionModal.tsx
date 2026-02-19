import { Modal } from 'antd';
import type React from 'react';
import { SubscriptionForm } from '../../subscriptions/SubscriptionForm';
import type { BotOption, SubscriptionFormData, SubscriptionWithDetails } from './types';

interface SubscriptionModalProps {
  open: boolean;
  editingSubscription: SubscriptionWithDetails | null;
  presetBotId: string;
  botOption: BotOption;
  loading: boolean;
  onSave: (data: SubscriptionFormData) => Promise<void>;
  onCancel: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  open,
  editingSubscription,
  presetBotId,
  botOption,
  loading,
  onSave,
  onCancel,
}) => (
  <Modal
    title={editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
    open={open}
    onCancel={onCancel}
    footer={null}
    width={500}
  >
    <SubscriptionForm
      editingSubscription={editingSubscription}
      presetBotId={presetBotId}
      bots={[botOption]}
      onSave={onSave}
      onCancel={onCancel}
      loading={loading}
    />
  </Modal>
);
