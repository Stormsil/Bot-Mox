import { Button, Spin } from 'antd';
import {
  DownOutlined,
  LeftOutlined,
  MinusSquareOutlined,
  PlusSquareOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { CSSProperties } from 'react';
import type { BotStatus, TreeItem } from './types';
import { statusConfig } from './types';
import { getIcon } from './tree-utils';
import styles from '../ResourceTree.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

interface ResourceTreeToolbarProps {
  isCollapsed: boolean;
  loading: boolean;
  isAllExpanded: boolean;
  hasExpandableKeys: boolean;
  onToggleCollapse: () => void;
  onToggleExpandAll: () => void;
}

export function ResourceTreeToolbar({
  isCollapsed,
  loading,
  isAllExpanded,
  hasExpandableKeys,
  onToggleCollapse,
  onToggleExpandAll,
}: ResourceTreeToolbarProps) {
  return (
    <div className={cx('resource-tree-toolbar')}>
      <button
        type="button"
        className={cx('resource-tree-collapse-btn')}
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        aria-label={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {isCollapsed ? <RightOutlined className={cx('resource-tree-icon-16')} /> : <LeftOutlined className={cx('resource-tree-icon-16')} />}
      </button>
      <div className={cx('resource-tree-toolbar-right')}>
        {loading && (
          <div className={cx('resource-tree-loading-inline')} title="Loading bots">
            <Spin size="small" />
          </div>
        )}
        <div className={cx('resource-tree-actions')}>
          <button
            type="button"
            className={cx('resource-tree-action-btn')}
            onClick={onToggleExpandAll}
            title={isAllExpanded ? 'Collapse all' : 'Expand all'}
            aria-label={isAllExpanded ? 'Collapse all' : 'Expand all'}
            disabled={!hasExpandableKeys}
          >
            {isAllExpanded ? <MinusSquareOutlined className={cx('resource-tree-icon-14')} /> : <PlusSquareOutlined className={cx('resource-tree-icon-14')} />}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ResourceTreeFiltersProps {
  showFilters: boolean;
  visibleStatuses: BotStatus[];
  onToggleShowFilters: () => void;
  onToggleStatus: (status: BotStatus) => void;
}

export function ResourceTreeFilters({
  showFilters,
  visibleStatuses,
  onToggleShowFilters,
  onToggleStatus,
}: ResourceTreeFiltersProps) {
  return (
    <div className={cx('resource-tree-filters-compact')}>
      <div className={cx('resource-tree-filters-header')}>
        <Button
          type="text"
          size="small"
          className={cx('filters-toggle-btn')}
          onClick={onToggleShowFilters}
          icon={showFilters ? <DownOutlined className={cx('resource-tree-icon-14')} /> : <RightOutlined className={cx('resource-tree-icon-14')} />}
        >
          Bot filters
        </Button>
      </div>

      {showFilters && (
        <div className={cx('filters-panel')}>
          {(Object.keys(statusConfig) as BotStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              className={cx(`filter-chip ${visibleStatuses.includes(status) ? 'active' : ''}`)}
              onClick={() => onToggleStatus(status)}
              style={{ '--status-color': statusConfig[status].color } as CSSProperties}
            >
              <span className={cx('filter-chip-indicator')} />
              <span className={cx('filter-chip-label')}>{statusConfig[status].title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ResourceTreeCollapsedNavProps {
  treeData: TreeItem[];
  selectedRootKey: string;
  onRootClick: (item: TreeItem) => void;
}

export function ResourceTreeCollapsedNav({
  treeData,
  selectedRootKey,
  onRootClick,
}: ResourceTreeCollapsedNavProps) {
  return (
    <div className={cx('resource-tree-collapsed-nav')}>
      {treeData.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cx(`resource-tree-collapsed-item ${selectedRootKey === item.key ? 'active' : ''}`)}
          onClick={() => onRootClick(item)}
          title={item.title}
          aria-label={item.title}
        >
          <span className={cx('resource-tree-icon-16')}>
            {getIcon(item.type, item.status, item.sectionKind)}
          </span>
        </button>
      ))}
    </div>
  );
}
