import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { SubscriptionWithDetails } from '../../../../entities/resources/model/types';
import type { Bot } from '../../../../shared/types';
import type {
  BotOption,
  ComputedSubscriptionStatus,
  SubscriptionType,
  SubscriptionTypeOption,
} from './types';

export const SUBSCRIPTION_TYPES: SubscriptionTypeOption[] = [
  { value: 'wow', label: 'WoW', color: 'blue' },
  { value: 'bot', label: 'Bot', color: 'purple' },
  { value: 'proxy', label: 'Proxy', color: 'cyan' },
  { value: 'vpn', label: 'VPN', color: 'geekblue' },
  { value: 'other', label: 'Other', color: 'default' },
];

export const getStatusIcon = (status: ComputedSubscriptionStatus) => {
  switch (status) {
    case 'expired':
      return <ExclamationCircleOutlined style={{ color: 'var(--botmox-color-status-danger)' }} />;
    case 'expiring_soon':
      return <ClockCircleOutlined style={{ color: 'var(--botmox-color-status-warning)' }} />;
    case 'active':
      return <CheckCircleOutlined style={{ color: 'var(--botmox-color-status-success)' }} />;
    default:
      return null;
  }
};

export const getStatusColor = (
  status: ComputedSubscriptionStatus,
): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (status) {
    case 'expired':
      return 'error';
    case 'expiring_soon':
      return 'warning';
    case 'active':
      return 'success';
    default:
      return 'default';
  }
};

export const getStatusText = (subscription: SubscriptionWithDetails) => {
  if (subscription.computedStatus === 'expired') return 'Expired';
  if (subscription.computedStatus === 'expiring_soon')
    return `Expires in ${subscription.daysRemaining} days`;
  return 'Active';
};

export const getTypeLabel = (type: SubscriptionType) =>
  SUBSCRIPTION_TYPES.find((item) => item.value === type)?.label || type;

export const getDaysLeftColor = (subscription: SubscriptionWithDetails): string => {
  if (subscription.isExpired) return 'var(--botmox-color-status-danger)';
  if (subscription.isExpiringSoon) return 'var(--botmox-color-status-warning)';
  if (typeof subscription.daysRemaining === 'number' && subscription.daysRemaining <= 3)
    return 'var(--botmox-color-status-danger)';
  if (typeof subscription.daysRemaining === 'number' && subscription.daysRemaining <= 7)
    return 'var(--botmox-color-status-warning)';
  return 'var(--botmox-color-status-success)';
};

export const isProblemSubscription = (subscription: SubscriptionWithDetails): boolean =>
  subscription.computedStatus === 'expired' || subscription.computedStatus === 'expiring_soon';

export const buildBotOption = (bot: Bot, botAccountEmail?: string | null): BotOption => ({
  id: bot.id,
  name: bot.name,
  character: bot.character?.name,
  status: bot.status,
  account_email: botAccountEmail || undefined,
});
