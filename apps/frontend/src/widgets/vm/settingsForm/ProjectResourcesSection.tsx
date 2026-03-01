import { InputNumber, Table, Typography } from 'antd';
import type React from 'react';
import styles from './ProjectResourcesSection.module.css';
import type { SettingsSectionProps } from './types';

const { Text } = Typography;

function mbToGiB(value: unknown): number {
  const mb = Number(value);
  if (!Number.isFinite(mb) || mb <= 0) {
    return 1;
  }
  return Math.max(1, Math.round(mb / 1024));
}

function giBToMb(value: number | null): number {
  const gib = Number(value);
  if (!Number.isFinite(gib) || gib <= 0) {
    return 1024;
  }
  return Math.max(1024, Math.trunc(gib) * 1024);
}

interface ProjectCardConfig {
  key: 'wow_tbc' | 'wow_midnight';
  title: string;
  description: string;
}

const PROJECT_CARDS: ProjectCardConfig[] = [
  {
    key: 'wow_tbc',
    title: 'WoW TBC',
    description: 'Default profile for TBC automation VMs.',
  },
  {
    key: 'wow_midnight',
    title: 'WoW Midnight',
    description: 'Default profile for Midnight automation VMs.',
  },
];

interface ResourceMatrixRow {
  key: 'cores' | 'memory' | 'disk';
  label: string;
  hint: string;
}

const RESOURCE_ROWS: ResourceMatrixRow[] = [
  {
    key: 'cores',
    label: 'CPU Cores',
    hint: 'vCPU count for new VMs in this project.',
  },
  {
    key: 'memory',
    label: 'RAM (GiB)',
    hint: 'Displayed in GiB; stored internally in MB.',
  },
  {
    key: 'disk',
    label: 'Disk (GiB)',
    hint: 'Target disk size for clone/resize flow.',
  },
];

export const ProjectResourcesSection: React.FC<SettingsSectionProps> = ({
  settings,
  onFieldChange,
}) => {
  const renderProjectInput = (project: ProjectCardConfig, row: ResourceMatrixRow) => {
    const data = settings.projectHardware[project.key];

    if (row.key === 'cores') {
      return (
        <InputNumber
          value={data.cores}
          onChange={(value) => onFieldChange(`projectHardware.${project.key}.cores`, value || 1)}
          size="small"
          min={1}
          max={64}
          step={1}
          style={{ width: '100%' }}
        />
      );
    }

    if (row.key === 'memory') {
      return (
        <InputNumber
          value={mbToGiB(data.memory)}
          onChange={(value) =>
            onFieldChange(`projectHardware.${project.key}.memory`, giBToMb(value))
          }
          size="small"
          min={1}
          max={512}
          step={1}
          style={{ width: '100%' }}
        />
      );
    }

    return (
      <InputNumber
        value={data.diskGiB}
        onChange={(value) => onFieldChange(`projectHardware.${project.key}.diskGiB`, value || 32)}
        size="small"
        min={32}
        max={4096}
        step={1}
        style={{ width: '100%' }}
      />
    );
  };

  return (
    <div className={styles.section}>
      <h4>Project Resource Profiles</h4>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Configure default CPU, RAM, and disk size for each project. RAM is edited in GiB and saved
        internally as MB.
      </Text>

      <div className={styles.matrixWrap}>
        <Table<ResourceMatrixRow>
          size="small"
          pagination={false}
          rowKey="key"
          className={styles.matrixTable}
          dataSource={RESOURCE_ROWS}
          columns={[
            {
              title: 'Parameter',
              dataIndex: 'label',
              key: 'parameter',
              width: '36%',
              render: (_value, row) => (
                <div className={styles.parameter}>
                  <Text strong>{row.label}</Text>
                  <Text type="secondary" className={styles.hint}>
                    {row.hint}
                  </Text>
                </div>
              ),
            },
            ...PROJECT_CARDS.map((project) => ({
              title: (
                <div className={styles.projectHead}>
                  <Text strong>{project.title}</Text>
                  <Text type="secondary" className={styles.projectDesc}>
                    {project.description}
                  </Text>
                </div>
              ),
              key: project.key,
              render: (_value: unknown, row: ResourceMatrixRow) => renderProjectInput(project, row),
            })),
          ]}
        />
      </div>
    </div>
  );
};
