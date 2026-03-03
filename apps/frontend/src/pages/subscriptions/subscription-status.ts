import type { ComputedSubscriptionStatus } from '../../entities/resources/model/types';
import { getSubscriptionStatusIntent } from '../../shared/lib/statusSemantic';

export const getSubscriptionStatusColor = (status: ComputedSubscriptionStatus) =>
  getSubscriptionStatusIntent(status);

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
