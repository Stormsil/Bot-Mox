import { DeleteOutlined, FolderOpenOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, List, Space } from 'antd';
import type React from 'react';
import type { ScheduleTemplate } from '../../types';
import { TableActionButton } from '../ui/TableActionButton';
import styles from './ScheduleGenerator.module.css';

interface ScheduleTemplateListProps {
  templates: ScheduleTemplate[];
  onApplyTemplate: (template: ScheduleTemplate) => void;
  onLoadTemplate: (template: ScheduleTemplate) => void;
  onDeleteTemplate: (event: React.MouseEvent, id: string) => void;
}

export const ScheduleTemplateList: React.FC<ScheduleTemplateListProps> = ({
  templates,
  onApplyTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}) => (
  <div className={styles['templates-list-container']}>
    <List
      size="small"
      dataSource={templates}
      renderItem={(item, index) => (
        <List.Item
          className={styles['template-item']}
          style={{
            padding: '10px 8px',
            borderBottom:
              index === templates.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className={styles['template-row']}>
            <div className={styles['template-info']}>
              <div className={styles['template-name']}>{item.name}</div>
              <div className={styles['template-details']}>
                {Math.floor(item.params.targetActiveMinutes / 60)}h{' '}
                {item.params.targetActiveMinutes % 60}m
                {item.params.useSecondWindow ? ' | 2 Windows' : ''}
              </div>
            </div>
            <div className={styles['template-actions']}>
              <Button
                type="primary"
                size="small"
                className={styles['template-apply-btn']}
                icon={<ThunderboltOutlined />}
                onClick={() => onApplyTemplate(item)}
              >
                Apply
              </Button>
              <Space size={0}>
                <TableActionButton
                  icon={<FolderOpenOutlined />}
                  onClick={() => onLoadTemplate(item)}
                  tooltip="Load parameters"
                />
                <TableActionButton
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(event) => onDeleteTemplate(event as React.MouseEvent, item.id)}
                  tooltip="Delete template"
                />
              </Space>
            </div>
          </div>
        </List.Item>
      )}
      locale={{ emptyText: 'No templates' }}
    />
  </div>
);
