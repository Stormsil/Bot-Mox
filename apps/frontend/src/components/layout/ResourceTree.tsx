import type { TreeDataNode } from 'antd';
import { Tree } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBotsMapQuery } from '../../entities/bot/api/useBotQueries';
import type { BotRecord } from '../../entities/bot/model/types';
import { useProjectSettingsQuery } from '../../entities/settings/api/useProjectSettingsQuery';
import {
  useResourceTreeSettingsQuery,
  useSaveResourceTreeSettingsMutation,
} from '../../entities/settings/api/useResourceTreeSettings';
import styles from './ResourceTree.module.css';
import { buildUnifiedTreeData } from './resourceTree/builders';
import { resolveStaticPathForTreeKey } from './resourceTree/navigation';
import {
  ResourceTreeCollapsedNav,
  ResourceTreeFilters,
  ResourceTreeToolbar,
} from './resourceTree/parts';
import {
  collectExpandableKeys,
  convertToTreeData,
  findNodePath,
  getSelectedKeysForLocation,
  isProjectsBranchKey,
  parseStatusGroupKey,
} from './resourceTree/tree-utils';
import type { TreeItem } from './resourceTree/types';
import {
  COLLAPSED_TREE_WIDTH,
  DEFAULT_TREE_WIDTH,
  MAX_TREE_WIDTH,
  MIN_TREE_WIDTH,
  useResourceTreePanelSizing,
} from './resourceTree/useResourceTreePanelSizing';
import { useResourceTreeState } from './resourceTree/useResourceTreeState';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

export type { BotStatus } from './resourceTree/types';

export const ResourceTree: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const botsMapQuery = useBotsMapQuery();
  const projectSettingsQuery = useProjectSettingsQuery();
  const resourceTreeSettingsQuery = useResourceTreeSettingsQuery();
  const saveResourceTreeSettingsMutation = useSaveResourceTreeSettingsMutation();
  const bots = useMemo<Record<string, BotRecord>>(
    () => (botsMapQuery.data || {}) as Record<string, BotRecord>,
    [botsMapQuery.data],
  );
  const projectsMeta = useMemo<Record<string, { id: string; name: string }>>(
    () =>
      Object.fromEntries(
        Object.entries(projectSettingsQuery.data || {}).map(([projectId, project]) => [
          projectId,
          { id: projectId, name: (project.name || projectId).trim() },
        ]),
      ),
    [projectSettingsQuery.data],
  );
  const loading = botsMapQuery.isLoading;
  const {
    treeWidth,
    isCollapsed,
    isResizing,
    setTreeWidth,
    setCollapsedState,
    handleResizeStart,
    handleResizerKeyDown,
  } = useResourceTreePanelSizing(containerRef);
  const {
    expandedKeys,
    showFilters,
    visibleStatuses,
    setExpandedKeys,
    setShowFilters,
    toggleStatus,
  } = useResourceTreeState({
    loading,
    resourceTreeSettingsQuery,
    saveResourceTreeSettingsMutation,
  });

  useEffect(() => {
    if (!botsMapQuery.error) {
      return;
    }
    console.error('Error loading bots:', botsMapQuery.error);
  }, [botsMapQuery.error]);
  useEffect(() => {
    if (!projectSettingsQuery.error) {
      return;
    }
    console.error('Error loading projects for resource tree:', projectSettingsQuery.error);
  }, [projectSettingsQuery.error]);
  useEffect(() => {
    if (!resourceTreeSettingsQuery.error) {
      return;
    }
    console.error('Error loading resource tree settings:', resourceTreeSettingsQuery.error);
  }, [resourceTreeSettingsQuery.error]);

  const treeData = useMemo(
    () => buildUnifiedTreeData({ bots, projectsMeta, visibleStatuses }),
    [bots, projectsMeta, visibleStatuses],
  );

  useEffect(() => {
    const nextSelectedKeys = getSelectedKeysForLocation(location.pathname, location.search);
    const frameId = window.requestAnimationFrame(() => {
      setSelectedKeys(nextSelectedKeys);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.pathname, location.search]);

  const navigateByTreeKey = useCallback(
    (key: string) => {
      if (key.startsWith('bot_') || bots[key]) {
        navigate(`/bot/${key}`);
        return;
      }

      const statusNode = parseStatusGroupKey(key);
      if (statusNode) {
        navigate(`/project/${statusNode.projectId}?status=${statusNode.status}`);
        return;
      }

      if (key.startsWith('project_')) {
        const projectId = key.replace('project_', '');
        navigate(`/project/${projectId}`);
        return;
      }

      const targetPath = resolveStaticPathForTreeKey(key);
      if (targetPath) {
        navigate(targetPath);
      }
    },
    [bots, navigate],
  );

  const handleCollapsedRootClick = useCallback(
    (item: TreeItem) => {
      if (item.type === 'section') {
        setCollapsedState(false);
        setExpandedKeys((prev) => {
          const set = new Set(prev.map(String));
          set.add(item.key);
          return Array.from(set);
        });
        return;
      }

      setSelectedKeys([item.key]);
      navigateByTreeKey(item.key);
    },
    [navigateByTreeKey, setCollapsedState, setExpandedKeys],
  );

  const treeDataNodes = useMemo(() => convertToTreeData(treeData, cx), [treeData]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys.map(String)), [selectedKeys]);
  const titleRender = useCallback(
    (node: TreeDataNode) => {
      const key = String(node.key);
      const isSelected = selectedKeySet.has(key);
      const rawTitle =
        typeof node.title === 'function' ? node.title(node) : (node.title as React.ReactNode);
      return (
        <span className={cx(`resource-tree-node-content ${isSelected ? 'selected' : ''}`)}>
          {rawTitle}
        </span>
      );
    },
    [selectedKeySet],
  );

  const selectedRootKey = useMemo(() => {
    if (selectedKeys.length === 0) return '';
    const selectedKey = String(selectedKeys[0]);
    const found = findNodePath(treeData, selectedKey);
    return found?.path[0] || '';
  }, [selectedKeys, treeData]);

  const expandableKeys = useMemo(() => collectExpandableKeys(treeData), [treeData]);

  const isAllExpanded = useMemo(() => {
    if (expandableKeys.length === 0) return false;
    const expandedSet = new Set(expandedKeys.map(String));
    return expandableKeys.every((key) => expandedSet.has(key));
  }, [expandableKeys, expandedKeys]);

  useEffect(() => {
    if (selectedKeys.length === 0) return;
    const targetKey = String(selectedKeys[0]);
    const found = findNodePath(treeData, targetKey);
    if (!found) return;
    if (found.path.some((key) => isProjectsBranchKey(key))) return;
    const shouldExpand =
      found.node.children && found.node.children.length > 0 ? found.path : found.path.slice(0, -1);
    if (shouldExpand.length === 0) return;

    const frameId = window.requestAnimationFrame(() => {
      setExpandedKeys((prev) => {
        const expandedSet = new Set(prev.map(String));
        let changed = false;
        shouldExpand.forEach((key) => {
          if (!expandedSet.has(key)) {
            expandedSet.add(key);
            changed = true;
          }
        });
        return changed ? Array.from(expandedSet) : prev;
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [selectedKeys, treeData, setExpandedKeys]);

  return (
    <div
      ref={containerRef}
      className={cx(
        `resource-tree-container ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`,
      )}
      style={{ width: isCollapsed ? COLLAPSED_TREE_WIDTH : treeWidth }}
    >
      <ResourceTreeToolbar
        isCollapsed={isCollapsed}
        loading={loading}
        isAllExpanded={isAllExpanded}
        hasExpandableKeys={expandableKeys.length > 0}
        onToggleCollapse={() => setCollapsedState(!isCollapsed)}
        onToggleExpandAll={() => setExpandedKeys(isAllExpanded ? [] : expandableKeys)}
      />

      <hr
        className={cx('resource-tree-resizer')}
        onMouseDown={handleResizeStart}
        onKeyDown={handleResizerKeyDown}
        onDoubleClick={() => setTreeWidth(DEFAULT_TREE_WIDTH)}
        tabIndex={isCollapsed ? -1 : 0}
        aria-label="Resize resource tree panel"
        aria-orientation="vertical"
        aria-valuemin={MIN_TREE_WIDTH}
        aria-valuemax={MAX_TREE_WIDTH}
        aria-valuenow={treeWidth}
      />

      <ResourceTreeFilters
        showFilters={showFilters}
        visibleStatuses={visibleStatuses}
        onToggleShowFilters={() => setShowFilters((prev) => !prev)}
        onToggleStatus={toggleStatus}
      />

      {isCollapsed && (
        <ResourceTreeCollapsedNav
          treeData={treeData}
          selectedRootKey={selectedRootKey}
          onRootClick={handleCollapsedRootClick}
        />
      )}

      <Tree
        className={cx('resource-tree')}
        treeData={treeDataNodes}
        expandedKeys={expandedKeys}
        selectedKeys={selectedKeys}
        onExpand={(expandedKeysValue) => setExpandedKeys(expandedKeysValue)}
        onSelect={(selectedKeysValue, info) => {
          const key = info.node.key as string;
          setSelectedKeys(selectedKeysValue);
          navigateByTreeKey(key);
        }}
        showLine={{ showLeafIcon: false }}
        showIcon={false}
        blockNode
        titleRender={titleRender}
      />
    </div>
  );
};
