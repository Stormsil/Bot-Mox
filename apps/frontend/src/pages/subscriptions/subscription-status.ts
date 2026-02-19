import type { ComputedSubscriptionStatus } from '../../types';

export const getSubscriptionStatusColor = (status: ComputedSubscriptionStatus) => {
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

export const getSubscriptionStatusText = (status: ComputedSubscriptionStatus) => {
  switch (status) {
    case 'expired':
      return 'Expired';
    case 'expiring_soon':
      return 'Expiring Soon';
    case 'active':
      return 'Active';
    default:
      return status;
  }
};
