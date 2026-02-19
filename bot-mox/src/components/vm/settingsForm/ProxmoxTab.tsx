import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import {
  Descriptions,
  Divider,
  InputNumber,
  Progress,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import type { VMGeneratorSettings, VMStorageOption } from '../../../types';
import { VMConfigPreview } from '../VMConfigPreview';
import styles from './ProxmoxTab.module.css';
import type { SettingsFieldUpdater, TemplateSyncState, TemplateVmSummary } from './types';

const { Text } = Typography;

interface ProxmoxTabProps {
  settings: VMGeneratorSettings;
  onFieldChange: SettingsFieldUpdater;
  syncState: TemplateSyncState;
  syncMessage: string;
  templateSummary: TemplateVmSummary | null;
  storageOptions: VMStorageOption[];
}

interface StorageRow {
  key: string;
  value: string;
  vmCount: number | null;
  usagePercent: number;
  usageLabel: string;
  freeLabel: string;
}

const formatGiBFromMb = (memoryMb: number): string => {
  const gib = memoryMb / 1024;
  if (!Number.isFinite(gib) || gib <= 0) return '-';
  return gib >= 10 ? `${gib.toFixed(0)} GiB` : `${gib.toFixed(1)} GiB`;
};

const formatGiBFromBytes = (bytes: number): string => {
  const gib = bytes / 1024 ** 3;
  if (!Number.isFinite(gib) || gib <= 0) return '-';
  return Number.isInteger(gib) ? `${gib.toFixed(0)} GiB` : `${gib.toFixed(1)} GiB`;
};

const formatGb = (bytes: number): string => {
  const gb = bytes / 1_000_000_000;
  if (!Number.isFinite(gb) || gb < 0) return '0.00';
  return gb.toFixed(2);
};

const buildStorageUsage = (
  opt: VMStorageOption,
): null | {
  percent: number;
  label: string;
  freeLabel: string;
} => {
  const used = Number(opt.usedBytes);
  const total = Number(opt.totalBytes);
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) return null;

  const percent = (used / total) * 100;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return {
    percent: safePercent,
    label: `${safePercent.toFixed(2)}% (${formatGb(used)} GB of ${formatGb(total)} GB)`,
    freeLabel: `${formatGb(Math.max(0, total - used))} GB free`,
  };
};

const LEGACY_STORAGE_PLACEHOLDER = 'disk';

const uniqueTrimmed = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
};

const mapDisplayName = (value: unknown): string => {
  const rawText = String(value || '').trim();
  if (!rawText) return '-';

  const raw = rawText.toLowerCase();
  const model = raw.split(',')[0]?.trim() || raw;

  if (model === 'default') return 'Default';
  if (model === 'std') return 'Standard VGA (std)';
  if (model === 'vmware') return 'VMware compatible';
  if (model === 'qxl') return 'SPICE';
  if (model === 'qxl2') return 'SPICE dual monitor';
  if (model === 'qxl3') return 'SPICE three monitors';
  if (model === 'qxl4') return 'SPICE four monitors';
  if (model === 'serial0') return 'Serial terminal 0';
  if (model === 'serial1') return 'Serial terminal 1';
  if (model === 'serial2') return 'Serial terminal 2';
  if (model === 'serial3') return 'Serial terminal 3';
  if (model === 'virtio') return 'VirtIO-GPU';
  if (model === 'virtio-gl') return 'VirGL GPU';
  if (model === 'cirrus') return 'Cirrus VGA';
  if (model === 'none') return 'none';

  return model;
};

export const ProxmoxTab: React.FC<ProxmoxTabProps> = ({
  settings,
  onFieldChange,
  syncState,
  syncMessage,
  templateSummary,
  storageOptions,
}) => {
  const rawEnabledValues = uniqueTrimmed(
    Array.isArray(settings.storage.enabledDisks) && settings.storage.enabledDisks.length > 0
      ? settings.storage.enabledDisks
      : (settings.storage.options ?? []),
  ).filter((value) => value.toLowerCase() !== LEGACY_STORAGE_PLACEHOLDER);
  const availableStorageValues = uniqueTrimmed(storageOptions.map((opt) => opt.value));
  const candidatePool =
    availableStorageValues.length > 0 ? availableStorageValues : rawEnabledValues;
  const enabledDisks = rawEnabledValues.filter((value) => candidatePool.includes(value));
  const autoSelectBest = settings.storage.autoSelectBest ?? true;

  const statusNode = templateSummary?.node;
  const statusVmId = templateSummary?.vmId ?? Number(settings.template.vmId);

  const statusIcon =
    syncState === 'loading' ? (
      <LoadingOutlined />
    ) : syncState === 'ok' ? (
      <CheckCircleFilled style={{ color: '#52c41a' }} />
    ) : syncState === 'error' ? (
      <CloseCircleFilled style={{ color: '#ff4d4f' }} />
    ) : (
      <span />
    );

  const statusText =
    syncState === 'loading'
      ? `Loading VM ${statusVmId}...`
      : syncState === 'ok'
        ? `VM ${statusVmId} found${statusNode ? ` on ${statusNode}` : ''}`
        : syncState === 'error'
          ? `Cannot load VM ${statusVmId}`
          : 'Template VM is not loaded yet.';

  const configuredDefaultRaw = String(settings.storage.default || '').trim();
  const configuredDefault =
    configuredDefaultRaw &&
    configuredDefaultRaw.toLowerCase() !== LEGACY_STORAGE_PLACEHOLDER &&
    candidatePool.includes(configuredDefaultRaw)
      ? configuredDefaultRaw
      : '';
  const storageCandidates = candidatePool;
  const storageByName = new Map(storageOptions.map((opt) => [opt.value, opt] as const));

  const pickBestStorage = (): string | null => {
    let best: { name: string; freeBytes: number } | null = null;

    for (const name of storageCandidates) {
      const opt = storageByName.get(name);
      const used = Number(opt?.usedBytes);
      const total = Number(opt?.totalBytes);
      if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) {
        continue;
      }

      const freeBytes = total - used;
      if (!Number.isFinite(freeBytes) || freeBytes < 0) {
        continue;
      }

      if (!best || freeBytes > best.freeBytes) {
        best = { name, freeBytes };
      }
    }

    if (best) {
      return best.name;
    }

    if (configuredDefault && storageCandidates.includes(configuredDefault)) {
      return configuredDefault;
    }

    return storageCandidates[0] ?? null;
  };

  const manualTarget = configuredDefault || enabledDisks[0] || storageCandidates[0] || null;
  const currentTarget = autoSelectBest ? pickBestStorage() : manualTarget;

  useEffect(() => {
    if (autoSelectBest) {
      return;
    }

    const selected = manualTarget;
    if (!selected) {
      return;
    }

    const needsEnabledSync = rawEnabledValues.length !== 1 || rawEnabledValues[0] !== selected;
    if (needsEnabledSync) {
      onFieldChange('storage.enabledDisks', [selected]);
    }

    if (configuredDefault !== selected) {
      onFieldChange('storage.default', selected);
    }
  }, [autoSelectBest, manualTarget, rawEnabledValues, configuredDefault, onFieldChange]);

  const handleManualTargetChange = (value: string) => {
    const selected = String(value || '').trim();
    if (!selected) return;

    onFieldChange('storage.enabledDisks', [selected]);
    onFieldChange('storage.default', selected);
  };

  const handleAutoSelectChange = (checked: boolean) => {
    onFieldChange('storage.autoSelectBest', checked);

    if (checked) {
      const pool = availableStorageValues.length > 0 ? availableStorageValues : storageCandidates;
      if (pool.length > 0) {
        onFieldChange('storage.enabledDisks', pool);
      }
      return;
    }

    if (!checked && currentTarget) {
      onFieldChange('storage.enabledDisks', [currentTarget]);
      onFieldChange('storage.default', currentTarget);
    }
  };

  const storageRows: StorageRow[] = (
    candidatePool.length > 0 ? candidatePool : storageOptions.map((opt) => opt.value)
  ).map((name) => {
    const opt = storageByName.get(name);
    const usage = opt ? buildStorageUsage(opt) : null;
    return {
      key: name,
      value: name,
      vmCount: typeof opt?.vmCount === 'number' ? opt.vmCount : null,
      usagePercent: usage?.percent ?? 0,
      usageLabel: usage?.label ?? (opt?.details || 'No usage data'),
      freeLabel: usage?.freeLabel ?? '-',
    };
  });

  return (
    <div className={styles.section}>
      <div className={styles.row}>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Clone Source VM ID</div>
          <InputNumber
            value={settings.template.vmId}
            onChange={(value) => onFieldChange('template.vmId', value || 100)}
            size="small"
            min={1}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div className={styles.templateStatus}>
        <Space size={8} align="center">
          {statusIcon}
          <Text>{statusText}</Text>
          {syncMessage ? (
            <Tooltip title={syncMessage}>
              <Text type="secondary" className={styles.templateStatusHint}>
                details
              </Text>
            </Tooltip>
          ) : null}
        </Space>
      </div>

      {syncState === 'ok' && templateSummary ? (
        <div className={styles.templateSummary}>
          <Descriptions
            size="small"
            column={2}
            labelStyle={{ color: 'var(--boxmox-color-text-secondary)', fontSize: 11 }}
            contentStyle={{
              color: 'var(--boxmox-color-text-primary)',
              fontSize: 12,
              fontWeight: 600,
            }}
            items={[
              {
                key: 'cores',
                label: 'CPU',
                children:
                  templateSummary.cores !== null && templateSummary.cores !== undefined
                    ? `${templateSummary.cores} cores`
                    : '-',
              },
              {
                key: 'mem',
                label: 'Memory',
                children:
                  templateSummary.memoryMb !== null && templateSummary.memoryMb !== undefined
                    ? formatGiBFromMb(templateSummary.memoryMb)
                    : '-',
              },
              {
                key: 'disk',
                label: 'Disk',
                children:
                  templateSummary.diskBytes !== null && templateSummary.diskBytes !== undefined
                    ? formatGiBFromBytes(templateSummary.diskBytes)
                    : '-',
              },
              {
                key: 'display',
                label: 'Display',
                children: mapDisplayName(templateSummary.display),
              },
            ]}
          />
        </div>
      ) : null}

      <h4 style={{ marginTop: 16 }}>Storage Targets</h4>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Select which storage targets to enable for VM cloning.
      </Text>

      {currentTarget ? (
        <div className={styles.storageCurrent}>
          <Text type="secondary">
            {autoSelectBest ? 'Current target (auto):' : 'Current target:'}
          </Text>
          <Text strong className={styles.storageCurrentValue}>
            {currentTarget}
          </Text>
        </div>
      ) : null}

      <div className={styles.storageTableWrap}>
        <Table<StorageRow>
          size="small"
          pagination={false}
          rowKey="key"
          className={styles.storageTable}
          dataSource={storageRows}
          rowClassName={(row) => (currentTarget === row.value ? styles.storageTableRowActive : '')}
          columns={[
            {
              title: '',
              key: 'pick',
              width: 52,
              render: (_value, row) => (
                <Radio
                  checked={manualTarget === row.value}
                  disabled={autoSelectBest}
                  onChange={() => handleManualTargetChange(row.value)}
                />
              ),
            },
            {
              title: 'Storage',
              key: 'storage',
              render: (_value, row) => (
                <Space size={8} align="center">
                  <Text strong>{row.value}</Text>
                  {currentTarget === row.value ? (
                    <Tag color="green">{autoSelectBest ? 'AUTO' : 'DEFAULT'}</Tag>
                  ) : null}
                </Space>
              ),
            },
            {
              title: 'VMs',
              key: 'vms',
              width: 88,
              render: (_value, row) => (
                <Text type="secondary">{row.vmCount !== null ? row.vmCount : '-'}</Text>
              ),
            },
            {
              title: 'Usage',
              key: 'usage',
              render: (_value, row) => (
                <div className={styles.storageUsage}>
                  <Progress percent={row.usagePercent} showInfo={false} size="small" />
                  <Text type="secondary" className={styles.storageUsageText}>
                    {row.usageLabel}
                  </Text>
                </div>
              ),
            },
            {
              title: 'Free',
              key: 'free',
              width: 130,
              render: (_value, row) => <Text type="secondary">{row.freeLabel}</Text>,
            },
          ]}
        />
      </div>

      <div className={`${styles.row} ${styles.rowCompact}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch size="small" checked={autoSelectBest} onChange={handleAutoSelectChange} />
          <Text>Auto-select best disk (most free space)</Text>
        </div>
      </div>

      <Divider style={{ margin: '16px 0 12px' }} />

      <h4 style={{ marginTop: 0 }}>Patch Preview</h4>
      <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
        Preview generated SMBIOS/MAC/serial patch values before processing the queue.
      </Text>
      <VMConfigPreview />
    </div>
  );
};
