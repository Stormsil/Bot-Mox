import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { Bot, SubscriptionWithDetails } from '../../../types';
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
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'expiring_soon':
      return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    case 'active':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    default:
      return null;
  }
};

export const getStatusColor = (status: ComputedSubscriptionStatus) => {
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
  if (subscription.isExpired) return '#ff4d4f';
  if (subscription.isExpiringSoon) return '#faad14';
  if (typeof subscription.daysRemaining === 'number' && subscription.daysRemaining <= 3)
    return '#ff4d4f';
  if (typeof subscription.daysRemaining === 'number' && subscription.daysRemaining <= 7)
    return '#faad14';
  return '#52c41a';
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
