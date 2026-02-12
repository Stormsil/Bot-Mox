import React from 'react';
import { PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { VMUiState } from '../../types';
import './VMStatusBar.css';

type VMServiceKind = 'proxmox' | 'tinyfm' | 'syncthing';

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
  onOpenPreview?: () => void;
  activeTopPanel?: 'settings' | 'preview' | null;
  activeService?: VMServiceKind;
  onSelectService?: (service: VMServiceKind) => void;
}

const badgeLabels: Record<VMUiState, string> = {
  ready: 'Ready',
  working: 'Working',
  success: 'Success',
  error: 'Error',
};

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
  onOpenPreview,
  activeTopPanel = null,
  activeService = 'proxmox',
  onSelectService,
}) => {
  const hasTopPanelButtons = Boolean(onOpenSettings || onOpenPreview);
  const hasServiceButtons = Boolean(onSelectService);

  return (
    <div className="vm-status-bar">
      <div className="vm-status-bar-controls">
        <button
          className="vm-status-bar-btn vm-status-bar-btn--start"
          onClick={onStart}
          disabled={isProcessing || !hasPending}
          title="Start processing (F5)"
        >
          <PlayCircleOutlined className="vm-status-bar-btn-icon" />
          <span>Start processing</span>
        </button>
        <button
          className="vm-status-bar-btn vm-status-bar-btn--stop"
          onClick={onStop}
          disabled={!isProcessing}
          title="Stop processing (F6)"
        >
          <StopOutlined className="vm-status-bar-btn-icon" />
          <span>Stop processing</span>
        </button>

        {hasTopPanelButtons && <div className="vm-status-bar-separator" />}

        {onOpenSettings && (
          <button
            className={`vm-status-bar-btn vm-status-bar-btn--service${activeTopPanel === 'settings' ? ' is-active' : ''}`}
            onClick={onOpenSettings}
          >
            Settings
          </button>
        )}
        {onOpenPreview && (
          <button
            className={`vm-status-bar-btn vm-status-bar-btn--service${activeTopPanel === 'preview' ? ' is-active' : ''}`}
            onClick={onOpenPreview}
          >
            Config Preview
          </button>
        )}

        {hasServiceButtons && <div className="vm-status-bar-separator" />}

        {hasServiceButtons && (
          <button
            className={`vm-status-bar-btn vm-status-bar-btn--service${activeService === 'proxmox' ? ' is-active' : ''}`}
            onClick={() => onSelectService?.('proxmox')}
          >
            Proxmox
          </button>
        )}
        {hasServiceButtons && (
          <button
            className={`vm-status-bar-btn vm-status-bar-btn--service${activeService === 'tinyfm' ? ' is-active' : ''}`}
            onClick={() => onSelectService?.('tinyfm')}
          >
            TinyFM
          </button>
        )}
        {hasServiceButtons && (
          <button
            className={`vm-status-bar-btn vm-status-bar-btn--service${activeService === 'syncthing' ? ' is-active' : ''}`}
            onClick={() => onSelectService?.('syncthing')}
          >
            SyncThing
          </button>
        )}
      </div>

      <div className="vm-status-bar-metrics">
        <span className="vm-status-chip">Queue {queueTotal}</span>
        <span className="vm-status-chip">Pending {pendingCount}</span>
        <span className="vm-status-chip">Active {activeCount}</span>
        <span className="vm-status-chip">Done {doneCount}</span>
        {errorCount > 0 && <span className="vm-status-chip vm-status-chip--error">Errors {errorCount}</span>}
      </div>

      <span className={`vm-status-bar-badge vm-status-bar-badge--${uiState}`}>
        <span title={operationText}>{badgeLabels[uiState]}</span>
      </span>
    </div>
  );
};
