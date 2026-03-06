import type { ComputedSubscriptionStatus } from '../../entities/resources/model/types';
import {
  getSubscriptionStatusIntent,
  getSubscriptionStatusText as getSubscriptionStatusSemanticText,
} from '../../shared/lib/statusSemantic';

export const getSubscriptionStatusColor = (status: ComputedSubscriptionStatus) =>
  getSubscriptionStatusIntent(status);

export const getSubscriptionStatusText = (status: ComputedSubscriptionStatus) => {
  if (status === 'active' || status === 'expiring_soon' || status === 'expired') {
    return getSubscriptionStatusSemanticText(status);
  }

  return status;
};
