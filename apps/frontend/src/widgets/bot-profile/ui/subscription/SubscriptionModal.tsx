import type { FormProps, ModalProps } from 'antd';
import type React from 'react';
import { AppModal } from '../../../../shared/ui';
import { SubscriptionForm } from '../../../../widgets/subscriptions/SubscriptionForm';
import type { BotOption, SubscriptionWithDetails } from './types';

interface SubscriptionModalProps {
  modalProps: ModalProps;
  formProps: FormProps;
  editingSubscription: SubscriptionWithDetails | null;
  presetBotId: string;
  botOption: BotOption;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  modalProps,
  formProps,
  editingSubscription,
  presetBotId,
  botOption,
}) => (
  <AppModal
    {...modalProps}
    title={editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
    footer={null}
    width={500}
  >
    <SubscriptionForm
      editingSubscription={editingSubscription}
      presetBotId={presetBotId}
      bots={[botOption]}
      formProps={formProps}
      onCancel={modalProps.onCancel as (() => void) | undefined}
    />
  </AppModal>
);
