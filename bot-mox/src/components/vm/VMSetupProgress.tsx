import React, { useEffect, useState } from 'react';
import { Steps, Tag, Typography } from 'antd';
import {
  getVmSetupProgress,
  type VmSetupProgressEntry,
} from '../../services/unattendProfileService';

const { Text } = Typography;

const STEP_ORDER = [
  'windows_installed',
  'downloader_ready',
  'app_downloaded',
  'playbook_running',
  'completed',
];

const STEP_LABELS: Record<string, string> = {
  windows_installed: 'Windows Installed',
  downloader_ready: 'Downloader Ready',
  app_downloaded: 'App Downloaded',
  playbook_running: 'Running Playbook',
  completed: 'Complete',
};

function statusToStepStatus(status: string): 'wait' | 'process' | 'finish' | 'error' {
  switch (status) {
    case 'completed':
      return 'finish';
    case 'running':
      return 'process';
    case 'failed':
      return 'error';
    default:
      return 'wait';
  }
}

interface VMSetupProgressProps {
  vmUuid: string;
  pollIntervalMs?: number;
}

export const VMSetupProgress: React.FC<VMSetupProgressProps> = ({
  vmUuid,
  pollIntervalMs = 5000,
}) => {
  const [entries, setEntries] = useState<VmSetupProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      try {
        const envelope = await getVmSetupProgress(vmUuid);
        if (!cancelled) setEntries(envelope.data || []);
      } catch {
        // Silently ignore polling errors
      }
      if (!cancelled) setLoading(false);
    };

    doLoad();
    const timer = setInterval(doLoad, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [vmUuid, pollIntervalMs]);

  // Build step map from entries (latest status per step)
  const stepMap = new Map<string, VmSetupProgressEntry>();
  for (const entry of entries) {
    const existing = stepMap.get(entry.step);
    if (!existing || new Date(entry.created_at) > new Date(existing.created_at)) {
      stepMap.set(entry.step, entry);
    }
  }

  // Find current step index
  let currentIndex = -1;
  for (let i = STEP_ORDER.length - 1; i >= 0; i--) {
    const entry = stepMap.get(STEP_ORDER[i]);
    if (entry && (entry.status === 'completed' || entry.status === 'running')) {
      currentIndex = i;
      break;
    }
  }

  if (loading && entries.length === 0) {
    return <Text type="secondary">Loading setup progress...</Text>;
  }

  if (entries.length === 0) {
    return <Text type="secondary">No setup progress reported yet</Text>;
  }

  return (
    <Steps
      direction="vertical"
      size="small"
      current={currentIndex}
      items={STEP_ORDER.map((step) => {
        const entry = stepMap.get(step);
        return {
          title: STEP_LABELS[step] || step,
          status: entry ? statusToStepStatus(entry.status) : 'wait',
          description: entry?.status === 'failed'
            ? <Tag color="red">Failed</Tag>
            : entry?.status === 'running'
              ? <Tag color="blue">In progress</Tag>
              : undefined,
        };
      })}
    />
  );
};
