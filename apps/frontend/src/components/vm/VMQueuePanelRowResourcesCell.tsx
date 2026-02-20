import { Button } from 'antd';
import type React from 'react';
import type { VMQueueItem } from '../../types';
import { formatMemoryGiB } from './queuePanelUtils';

interface VMQueuePanelRowResourcesCellProps {
  item: VMQueueItem;
  isDeleteAction: boolean;
  effectiveCores: number;
  effectiveMemoryMb: number;
  effectiveDiskGiB: number;
  openCustomEditor: (item: VMQueueItem) => void;
  className: (classNames: string) => string;
}

export const VMQueuePanelRowResourcesCell: React.FC<VMQueuePanelRowResourcesCellProps> = ({
  item,
  isDeleteAction,
  effectiveCores,
  effectiveMemoryMb,
  effectiveDiskGiB,
  openCustomEditor,
  className,
}) => {
  return (
    <div className={className('vm-queue-item-resources')}>
      {isDeleteAction ? (
        <div className={className('vm-queue-item-placeholder')}>Delete operation</div>
      ) : (
        <div className={className('vm-queue-item-resources-compact')}>
          <div className={className('vm-queue-item-resources-text')}>
            {effectiveCores} CPU · {formatMemoryGiB(effectiveMemoryMb)} · {effectiveDiskGiB} GB
          </div>
          {item.resourceMode === 'custom' && (
            <Button
              type="text"
              size="small"
              className={className('vm-queue-item-resource-edit')}
              style={{
                height: 20,
                paddingInline: 6,
                fontSize: 10,
                color: 'var(--boxmox-color-brand-primary)',
              }}
              onClick={() => openCustomEditor(item)}
              title="Edit Custom Resources"
            >
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
