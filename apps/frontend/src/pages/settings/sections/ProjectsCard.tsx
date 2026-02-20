import { DesktopOutlined } from '@ant-design/icons';
import { Button, Card, Col, Space, Typography } from 'antd';
import type React from 'react';
import type { ProjectSettings } from '../../../entities/settings/model/projectSettings';
import { cx } from './classNames';

const { Text } = Typography;

interface ProjectsCardProps {
  projectsVisible: boolean;
  projectEntries: Array<[string, ProjectSettings]>;
  onToggleVisibility: () => void;
}

export const ProjectsCard: React.FC<ProjectsCardProps> = ({
  projectsVisible,
  projectEntries,
  onToggleVisibility,
}) => {
  return (
    <Col span={24}>
      <Card
        title={
          <Space>
            <DesktopOutlined />
            <span>Projects</span>
          </Space>
        }
        extra={<Button onClick={onToggleVisibility}>{projectsVisible ? 'Hide' : 'Show'}</Button>}
        className={cx('settings-card')}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          View configured projects only. New project support is added by developers.
        </Text>
        {!projectsVisible ? null : projectEntries.length === 0 ? (
          <div className={cx('project-settings-empty')}>
            <Text type="secondary">No projects configured yet</Text>
          </div>
        ) : (
          <div className={cx('project-settings-list')}>
            {projectEntries.map(([projectId, project]) => (
              <div key={projectId} className={cx('project-settings-item')}>
                <div className={cx('project-settings-item-header')}>
                  <div className={cx('project-settings-item-title')}>
                    <Text strong>{project.name || projectId}</Text>
                    <Text code>{projectId}</Text>
                  </div>
                </div>
                <div className={cx('project-settings-item-meta')}>
                  <Text type="secondary">Game: {project.game || '-'}</Text>
                  <Text type="secondary">Expansion: {project.expansion || '-'}</Text>
                  <Text type="secondary">
                    Max level: {typeof project.max_level === 'number' ? project.max_level : '-'}
                  </Text>
                  <Text type="secondary">Region: {project.server_region || '-'}</Text>
                  <Text type="secondary">
                    Currency: {project.currency || '-'} {project.currency_symbol || ''}
                  </Text>
                  <Text type="secondary">
                    Professions:{' '}
                    {Array.isArray(project.professions) && project.professions.length > 0
                      ? project.professions.join(', ')
                      : '-'}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Col>
  );
};
