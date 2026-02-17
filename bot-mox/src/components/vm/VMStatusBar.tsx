import React from 'react';
import { PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { VMUiState } from '../../types';
import styles from './VMStatusBar.module.css';

interface VMStatusBarProps {
  uiState: VMUiState;
  operationText: string;
  isProcessing: boolean;
  hasPending: boolean;
  queueTotal?: number;
  pendingCount?: number;
  activeCount?: number;
  doneCount?: number;
  errorCount?: number;
  onStart: () => void;
  onStop: () => void;
  onOpenSettings?: () => void;
  activeTopPanel?: 'settings' | null;
}

const badgeLabels: Record<VMUiState, string> = {
  ready: 'Ready',
  working: 'Working',
  success: 'Success',
  error: 'Error',
};

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export const VMStatusBar: React.FC<VMStatusBarProps> = ({
  uiState,
  operationText,
  isProcessing,
  hasPending,
  queueTotal = 0,
  pendingCount = 0,
  activeCount = 0,
  doneCount = 0,
  errorCount = 0,
  onStart,
  onStop,
  onOpenSettings,
  activeTopPanel = null,
}) => {
  const hasTopPanelButtons = Boolean(onOpenSettings);
  const badgeStateClass =
    uiState === 'ready'
      ? styles.badgeReady
      : uiState === 'working'
        ? styles.badgeWorking
        : uiState === 'success'
          ? styles.badgeSuccess
          : styles.badgeError;

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <button
          type="button"
          className={cx(styles.btn, styles.btnStart)}
          onClick={onStart}
          disabled={isProcessing || !hasPending}
          title="Start processing (F5)"
        >
          <PlayCircleOutlined className={styles.btnIcon} />
          <span>Start processing</span>
        </button>
        <button
          type="button"
          className={cx(styles.btn, styles.btnStop)}
          onClick={onStop}
          disabled={!isProcessing}
          title="Stop processing (F6)"
        >
          <StopOutlined className={styles.btnIcon} />
          <span>Stop processing</span>
        </button>

        {hasTopPanelButtons && <div className={styles.separator} />}

        {onOpenSettings && (
          <button
            type="button"
            className={cx(
              styles.btn,
              styles.btnService,
              activeTopPanel === 'settings' && styles.btnServiceActive,
            )}
            onClick={onOpenSettings}
          >
            Settings
          </button>
        )}
      </div>

      <div className={styles.metrics}>
        <span className={styles.chip}>Queue {queueTotal}</span>
        <span className={styles.chip}>Pending {pendingCount}</span>
        <span className={styles.chip}>Active {activeCount}</span>
        <span className={styles.chip}>Done {doneCount}</span>
        {errorCount > 0 && <span className={cx(styles.chip, styles.chipError)}>Errors {errorCount}</span>}
      </div>

      <span className={cx(styles.badge, badgeStateClass)}>
        <span title={operationText}>{badgeLabels[uiState]}</span>
      </span>
    </div>
  );
};
