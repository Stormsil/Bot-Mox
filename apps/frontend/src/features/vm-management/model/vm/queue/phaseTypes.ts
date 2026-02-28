import type { VMQueueItem } from '../../../../../shared/types';

export interface ClonedVmQueueItem {
  item: VMQueueItem;
  vmId: number;
}
