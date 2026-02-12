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
    <div className="resource-tree-toolbar">
      <button
        type="button"
        className="resource-tree-collapse-btn"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        aria-label={isCollapsed ? 'Show sidebar' : 'Hide sidebar'}
      >
        {isCollapsed ? <RightOutlined /> : <LeftOutlined />}
      </button>
      <div className="resource-tree-toolbar-right">
        {loading && (
          <div className="resource-tree-loading-inline" title="Loading bots">
            <Spin size="small" />
          </div>
        )}
        <div className="resource-tree-actions">
          <button
            type="button"
            className="resource-tree-action-btn"
            onClick={onToggleExpandAll}
            title={isAllExpanded ? 'Collapse all' : 'Expand all'}
            aria-label={isAllExpanded ? 'Collapse all' : 'Expand all'}
            disabled={!hasExpandableKeys}
          >
            {isAllExpanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />}
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
    <div className="resource-tree-filters-compact">
      <div className="resource-tree-filters-header">
        <Button
          type="text"
          size="small"
          className="filters-toggle-btn"
          onClick={onToggleShowFilters}
          icon={showFilters ? <DownOutlined /> : <RightOutlined />}
        >
          Bot filters
        </Button>
      </div>

      {showFilters && (
        <div className="filters-panel">
          {(Object.keys(statusConfig) as BotStatus[]).map((status) => (
            <button
              key={status}
              className={`filter-chip ${visibleStatuses.includes(status) ? 'active' : ''}`}
              onClick={() => onToggleStatus(status)}
              style={{ '--status-color': statusConfig[status].color } as CSSProperties}
            >
              <span className="filter-chip-indicator" />
              <span className="filter-chip-label">{statusConfig[status].title}</span>
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
    <div className="resource-tree-collapsed-nav">
      {treeData.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`resource-tree-collapsed-item ${selectedRootKey === item.key ? 'active' : ''}`}
          onClick={() => onRootClick(item)}
          title={item.title}
          aria-label={item.title}
        >
          {getIcon(item.type, item.status, item.sectionKind)}
        </button>
      ))}
    </div>
  );
}
