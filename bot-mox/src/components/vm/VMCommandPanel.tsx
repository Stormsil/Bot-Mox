import React, { useMemo, useState } from 'react';
import { message } from 'antd';
import { startAndSendKeyBatch } from '../../services/vmService';
import styles from './VMCommandPanel.module.css';

interface VMCommandPanelProps {
  vmIds: number[];
  node: string;
  onRunFinished?: () => void | Promise<void>;
}

export const VMCommandPanel: React.FC<VMCommandPanelProps> = ({
  vmIds,
  node,
  onRunFinished,
}) => {
  const [isRunning, setIsRunning] = useState(false);

  const normalizedVmIds = useMemo(() => (
    Array.from(new Set(
      (vmIds || [])
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && id > 0)
    ))
  ), [vmIds]);

  if (normalizedVmIds.length === 0) return null;

  const vmIdsText = normalizedVmIds.join(', ');

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const result = await startAndSendKeyBatch(normalizedVmIds, {
        node,
        key: 'a',
        repeatCount: 10,
        intervalMs: 1000,
        startupDelayMs: 3000,
      });

      if (result.failed === 0) {
        message.success(`VM start completed: ${result.ok}/${result.total}`);
      } else {
        const failedPreview = result.results
          .filter(item => !item.success)
          .slice(0, 2)
          .map(item => `VM ${item.vmid}: ${item.error || 'Unknown error'}`)
          .join(' | ');
        message.warning(
          `Completed with errors: ${result.ok}/${result.total}. ${failedPreview}`
        );
      }
      await Promise.resolve(onRunFinished?.());
    } catch (err) {
      message.error(`Start API error: ${(err as Error).message}`);
    } finally {
      setIsRunning(false);
    }
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
            disabled={isRunning}
          >
            {isRunning ? 'Starting...' : 'Start VMs'}
          </button>
        </div>
      </div>
    </div>
  );
};
