import { message } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useStartAndSendKeyBatchMutation } from '../../entities/vm/api/useVmActionMutations';
import styles from './VMCommandPanel.module.css';

interface VMCommandPanelProps {
  vmIds: number[];
  node: string;
  onRunFinished?: () => void | Promise<void>;
}

export const VMCommandPanel: React.FC<VMCommandPanelProps> = ({ vmIds, node, onRunFinished }) => {
  const startAndSendKeyBatchMutation = useStartAndSendKeyBatchMutation();

  const normalizedVmIds = useMemo(
    () =>
      Array.from(
        new Set(
          (vmIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0),
        ),
      ),
    [vmIds],
  );

  if (normalizedVmIds.length === 0) return null;

  const vmIdsText = normalizedVmIds.join(', ');

  const handleRun = () => {
    if (startAndSendKeyBatchMutation.isPending) return;

    startAndSendKeyBatchMutation.mutate(
      {
        vmIds: normalizedVmIds,
        options: {
          node,
          key: 'a',
          repeatCount: 10,
          intervalMs: 1000,
          startupDelayMs: 3000,
        },
      },
      {
        onSuccess: async (result) => {
          if (result.failed === 0) {
            message.success(`VM start completed: ${result.ok}/${result.total}`);
          } else {
            const failedPreview = result.results
              .filter((item) => !item.success)
              .slice(0, 2)
              .map((item) => `VM ${item.vmid}: ${item.error || 'Unknown error'}`)
              .join(' | ');
            message.warning(
              `Completed with errors: ${result.ok}/${result.total}. ${failedPreview}`,
            );
          }

          await Promise.resolve(onRunFinished?.());
        },
        onError: (err) => {
          message.error(`Start API error: ${err.message}`);
        },
      },
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>VM Start Action</div>
      <div className={styles.body}>
        <code className={styles.code}>Ready VM IDs: {vmIdsText}</code>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleRun}
            className={`${styles.actionBtn} ${styles.runBtn}`}
            disabled={startAndSendKeyBatchMutation.isPending}
          >
            {startAndSendKeyBatchMutation.isPending ? 'Starting...' : 'Start VMs'}
          </button>
        </div>
      </div>
    </div>
  );
};
