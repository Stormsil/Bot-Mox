import React from 'react';
import { Select } from 'antd';
import type { VMQueueItem, VMQueueItemStatus, VMStorageOption } from '../../types';
import './VMQueuePanel.css';

interface VMQueuePanelProps {
  queue: VMQueueItem[];
  isProcessing: boolean;
  isStartActionRunning?: boolean;
  canStartAll?: boolean;
  startingItemId?: string | null;
  storageOptions: VMStorageOption[];
  projectOptions: Array<{ value: string; label: string }>;
  onAdd: () => void;
  onAddDelete?: () => void;
  onClear: () => void;
  onStartAll?: () => void;
  onStartOne?: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<VMQueueItem>) => void;
}

function toMemoryMb(memory?: number): number | null {
  if (!Number.isFinite(memory)) return null;
  const value = Math.max(0, Math.trunc(Number(memory)));
  if (value <= 0) return null;
  if (value <= 64) return value * 1024;
  return value;
}

function toMemoryGbInput(memory?: number): string {
  const memoryMb = toMemoryMb(memory);
  if (!memoryMb) return '';
  const gb = memoryMb / 1024;
  if (Number.isInteger(gb)) return String(gb);
  return gb.toFixed(1);
}

function parseMemoryInputToMb(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n <= 64) return Math.round(n * 1024);
  return Math.round(n);
}

function parseCoresInput(value: string): number | undefined {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.max(1, Math.trunc(n));
}

function getStatusDisplay(status: VMQueueItemStatus): { text: string; tone: 'idle' | 'running' | 'ok' | 'error' } {
  switch (status) {
    case 'done':
      return { text: 'Done', tone: 'ok' };
    case 'cloned':
      return { text: 'Queued', tone: 'idle' };
    case 'cloning':
      return { text: 'Running', tone: 'running' };
    case 'configuring':
      return { text: 'Running', tone: 'running' };
    case 'deleting':
      return { text: 'Deleting', tone: 'running' };
    case 'error':
      return { text: 'Error', tone: 'error' };
    default:
      return { text: 'Queued', tone: 'idle' };
  }
}

export const VMQueuePanel: React.FC<VMQueuePanelProps> = ({
  queue,
  isProcessing,
  isStartActionRunning = false,
  canStartAll = false,
  startingItemId = null,
  storageOptions,
  projectOptions,
  onAdd,
  onAddDelete,
  onClear,
  onStartAll,
  onStartOne,
  onRemove,
  onUpdate,
}) => {
  return (
    <div className="vm-queue-panel">
      <div className="vm-queue-panel-header">
        <div className="vm-queue-panel-header-main">
          <span className="vm-queue-panel-header-title">VM Queue</span>
        </div>
        <div className="vm-queue-panel-header-actions">
          <button
            className="vm-queue-panel-start-all"
            onClick={onStartAll}
            disabled={isProcessing || isStartActionRunning || !canStartAll || !onStartAll}
          >
            {isStartActionRunning ? 'Starting...' : 'Start all'}
          </button>
          <button onClick={onAddDelete} disabled={isProcessing || !onAddDelete}>Delete VM</button>
          <button onClick={onAdd} disabled={isProcessing}>+ VM</button>
          <button onClick={onClear} disabled={isProcessing || isStartActionRunning}>Clear</button>
        </div>
      </div>

      <div className="vm-queue-panel-list">
        {queue.length === 0 ? (
          <div className="vm-queue-panel-empty">
            Queue is empty. Press "+ VM" or Ctrl+N to create a VM.
          </div>
        ) : (
          <>
            <div className="vm-queue-columns">
              <span className="vm-queue-columns-name">VM</span>
              <span>Storage</span>
              <span>Project</span>
              <span>Resources</span>
              <span className="vm-queue-columns-status">State</span>
              <span className="vm-queue-columns-remove" />
            </div>

            {queue.map((item) => {
              const action = item.action || 'create';
              const isDeleteAction = action === 'delete';
              const status = getStatusDisplay(item.status);
              const deleteTargetVmId = Number(item.targetVmId ?? item.vmId);
              const hasDeleteTargetVmId = Number.isInteger(deleteTargetVmId) && deleteTargetVmId > 0;
              const memoryMb = toMemoryMb(item.memory);
              const memoryGbValue = toMemoryGbInput(item.memory);
              const coresValue = Number.isFinite(item.cores) && Number(item.cores) > 0
                ? String(Math.trunc(Number(item.cores)))
                : '';
              const editableCreate = !isDeleteAction && (!isProcessing || item.status === 'pending');
              const canRemove = !isProcessing && !isStartActionRunning;
              const canStartItem = !isDeleteAction
                && item.status === 'done'
                && Number.isInteger(Number(item.vmId))
                && Number(item.vmId) > 0
                && typeof onStartOne === 'function';
              const isItemStarting = isStartActionRunning && startingItemId === item.id;
              const vmInputValue = isDeleteAction && hasDeleteTargetVmId
                ? `${item.name} [ID ${deleteTargetVmId}]`
                : item.name;

              return (
                <div key={item.id} className="vm-queue-item">
                  <div className="vm-queue-item-vm">
                    <input
                      className="vm-queue-item-input vm-queue-item-input--name"
                      value={vmInputValue}
                      onChange={e => {
                        if (!isDeleteAction) {
                          onUpdate(item.id, { name: e.target.value });
                        }
                      }}
                      disabled={!editableCreate}
                      placeholder="VM name"
                    />
                  </div>

                  <div className="vm-queue-item-select vm-queue-item-select--storage">
                    {isDeleteAction ? (
                      <div className="vm-queue-item-placeholder">-</div>
                    ) : (
                      <Select
                        className="vm-queue-storage-select"
                        value={item.storage}
                        onChange={value => onUpdate(item.id, { storage: value })}
                        disabled={!editableCreate}
                        optionLabelProp="label"
                        popupMatchSelectWidth={false}
                        classNames={{ popup: { root: 'vm-queue-storage-dropdown' } }}
                      >
                        {storageOptions.map(opt => (
                          <Select.Option
                            key={opt.value}
                            value={opt.value}
                            label={opt.label}
                          >
                            {opt.details ? `${opt.label} | ${opt.details}` : opt.label}
                          </Select.Option>
                        ))}
                      </Select>
                    )}
                  </div>

                  <div className="vm-queue-item-select vm-queue-item-select--project">
                    {isDeleteAction ? (
                      <div className="vm-queue-item-placeholder">-</div>
                    ) : (
                      <select
                        value={item.projectId}
                        onChange={e => onUpdate(item.id, { projectId: e.target.value as 'wow_tbc' | 'wow_midnight' })}
                        disabled={!editableCreate}
                      >
                        {projectOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="vm-queue-item-resources">
                    {isDeleteAction ? (
                      <div className="vm-queue-item-placeholder">Delete operation</div>
                    ) : (
                      <div className="vm-queue-item-resource-inputs">
                        <label className="vm-queue-item-resource-row">
                          <span>CPU</span>
                          <input
                            className="vm-queue-item-input"
                            type="number"
                            min={1}
                            step={1}
                            value={coresValue}
                            onChange={e => onUpdate(item.id, { cores: parseCoresInput(e.target.value) })}
                            disabled={!editableCreate}
                          />
                          <em>cores</em>
                        </label>
                        <label className="vm-queue-item-resource-row">
                          <span>RAM</span>
                          <input
                            className="vm-queue-item-input"
                            type="number"
                            min={1}
                            step={1}
                            value={memoryGbValue}
                            onChange={e => onUpdate(item.id, { memory: parseMemoryInputToMb(e.target.value) })}
                            disabled={!editableCreate}
                          />
                          <em>{memoryMb ? `${memoryMb} MB` : '-'}</em>
                        </label>
                      </div>
                    )}
                  </div>

                  {canStartItem ? (
                    <button
                      className="vm-queue-item-start"
                      onClick={() => onStartOne?.(item.id)}
                      disabled={isProcessing || isStartActionRunning}
                      title={item.vmId ? `Start VM ${item.vmId}` : 'Start VM'}
                    >
                      {isItemStarting ? 'Starting...' : 'Start'}
                    </button>
                  ) : (
                    <span className={`vm-queue-item-status vm-queue-item-status--${status.tone}`}>
                      {status.text}
                    </span>
                  )}

                  <button
                    className="vm-queue-item-remove"
                    onClick={() => onRemove(item.id)}
                    disabled={!canRemove}
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
