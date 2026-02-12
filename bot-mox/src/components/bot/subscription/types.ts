import type {
  Bot,
  ComputedSubscriptionStatus,
  SubscriptionFormData,
  SubscriptionType,
  SubscriptionWithDetails,
} from '../../../types';

export interface BotSubscriptionProps {
  bot: Bot;
}

export interface BotOption {
  id: string;
  name: string;
  character?: string;
  status: string;
  account_email?: string;
}

export interface SubscriptionTypeOption {
  value: SubscriptionType;
  label: string;
  color: string;
}

export type {
  SubscriptionFormData,
  SubscriptionWithDetails,
  SubscriptionType,
  ComputedSubscriptionStatus,
};
