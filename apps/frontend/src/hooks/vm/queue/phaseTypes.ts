import type { VMQueueItem } from '../../../types';

export interface ClonedVmQueueItem {
  item: VMQueueItem;
  vmId: number;
}
