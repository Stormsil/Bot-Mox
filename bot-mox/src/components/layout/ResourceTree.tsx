import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tree } from 'antd';
import type { TreeDataNode } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { subscribeBotsMap } from '../../services/botsApiService';
import type { BotRecord } from '../../services/botsApiService';
import { subscribeToProjectSettings } from '../../services/projectSettingsService';
import { fetchResourceTreeSettings, saveResourceTreeSettings } from '../../services/resourceTreeSettingsService';
import { buildUnifiedTreeData } from './resourceTree/builders';
import {
  ResourceTreeCollapsedNav,
  ResourceTreeFilters,
  ResourceTreeToolbar,
} from './resourceTree/parts';
import {
  COLLAPSED_TREE_WIDTH,
  DEFAULT_TREE_WIDTH,
  MAX_TREE_WIDTH,
  MIN_TREE_WIDTH,
  RESOURCE_TREE_COLLAPSED_KEY,
  RESOURCE_TREE_WIDTH_KEY,
  ROOT_SECTION_KEYS,
  SHOW_FILTERS_KEY,
  DEFAULT_VISIBLE_STATUSES,
  sanitizeBotStatuses,
} from './resourceTree/types';
import type { BotStatus, TreeItem } from './resourceTree/types';
import {
  collectExpandableKeys,
  convertToTreeData,
  findNodePath,
  getSelectedKeysForLocation,
  isProjectsBranchKey,
  parseStatusGroupKey,
} from './resourceTree/tree-utils';
import { resolveStaticPathForTreeKey } from './resourceTree/navigation';
import styles from './ResourceTree.module.css';

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
  const isResizingRef = React.useRef(false);

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [bots, setBots] = useState<Record<string, BotRecord>>({});
  const [projectsMeta, setProjectsMeta] = useState<Record<string, { id: string; name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasRemoteSettings, setHasRemoteSettings] = useState(false);
  const [treeWidth, setTreeWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_TREE_WIDTH;
    const stored = Number(localStorage.getItem(RESOURCE_TREE_WIDTH_KEY));
    if (!Number.isFinite(stored)) return DEFAULT_TREE_WIDTH;
    return Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, stored));
  });
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(RESOURCE_TREE_COLLAPSED_KEY) === 'true';
  });
  const [isResizing, setIsResizing] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<BotStatus[]>(DEFAULT_VISIBLE_STATUSES);

  useEffect(() => {
    let isMounted = true;

    fetchResourceTreeSettings()
      .then((data) => {
        if (!isMounted) return;

        if (data) {
          setHasRemoteSettings(true);
          if (data.visibleStatuses?.length) {
            setVisibleStatuses(sanitizeBotStatuses(data.visibleStatuses));
          }
          if (Array.isArray(data.expandedKeys)) {
            setExpandedKeys(data.expandedKeys);
          }
          if (typeof data.showFilters === 'boolean') {
            setShowFilters(data.showFilters);
          }
        } else {
          try {
            const savedFilters = localStorage.getItem('resourceTreeFilters');
            if (savedFilters) {
              setVisibleStatuses(sanitizeBotStatuses(JSON.parse(savedFilters)));
            }
            const savedExpanded = localStorage.getItem('resourceTreeExpanded');
            if (savedExpanded) {
              setExpandedKeys(JSON.parse(savedExpanded));
            }
            const savedShowFilters = localStorage.getItem(SHOW_FILTERS_KEY);
            if (savedShowFilters) {
              setShowFilters(JSON.parse(savedShowFilters));
            }
          } catch (error) {
            console.warn('Failed to parse local resource tree settings:', error);
          }
        }

        setSettingsLoaded(true);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Error loading resource tree settings:', error);
        setSettingsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeBotsMap(
      (data) => {
        setBots(data || {});
        setLoading(false);
      },
      (error) => {
        console.error('Error loading bots:', error);
        setLoading(false);
      },
      { intervalMs: 5000 }
    );
  }, []);

  useEffect(() => {
    return subscribeToProjectSettings(
      (projects) => {
        const mapped = Object.fromEntries(
          Object.entries(projects).map(([projectId, project]) => [
            projectId,
            {
              id: projectId,
              name: (project.name || projectId).trim(),
            },
          ])
        );
        setProjectsMeta(mapped);
      },
      (error) => {
        console.error('Error loading projects for resource tree:', error);
      }
    );
  }, []);

  const treeData = useMemo(
    () => buildUnifiedTreeData({ bots, projectsMeta, visibleStatuses }),
    [bots, projectsMeta, visibleStatuses]
  );

  useEffect(() => {
    if (!settingsLoaded || hasRemoteSettings || loading) return;
    if (expandedKeys.length > 0) return;

    const frameId = window.requestAnimationFrame(() => {
      setExpandedKeys([...ROOT_SECTION_KEYS]);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [settingsLoaded, hasRemoteSettings, loading, expandedKeys.length]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const payload = {
      expandedKeys: expandedKeys.map((key) => String(key)),
      visibleStatuses,
      showFilters,
      updated_at: Date.now(),
    };

    const timeout = setTimeout(() => {
      saveResourceTreeSettings(payload).catch((error) => {
        console.error('Error saving resource tree settings:', error);
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [settingsLoaded, expandedKeys, visibleStatuses, showFilters]);

  useEffect(() => {
    try {
      localStorage.setItem('resourceTreeExpanded', JSON.stringify(expandedKeys));
      localStorage.setItem('resourceTreeFilters', JSON.stringify(visibleStatuses));
      localStorage.setItem(SHOW_FILTERS_KEY, JSON.stringify(showFilters));
    } catch (error) {
      console.warn('Failed to save local resource tree cache:', error);
    }
  }, [expandedKeys, visibleStatuses, showFilters]);

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
    [bots, navigate]
  );

  const setCollapsedState = useCallback((next: boolean) => {
    setIsCollapsed(next);
    try {
      localStorage.setItem(RESOURCE_TREE_COLLAPSED_KEY, String(next));
    } catch (error) {
      console.warn('Failed to save resource tree collapse state:', error);
    }
  }, []);

  const handleCollapsedRootClick = useCallback((item: TreeItem) => {
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
  }, [navigateByTreeKey, setCollapsedState]);

  const toggleStatus = useCallback(
    (status: BotStatus) => {
      setVisibleStatuses((prev) => (
        prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status]
      ));
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(RESOURCE_TREE_WIDTH_KEY, String(treeWidth));
  }, [treeWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, event.clientX - rect.left));
      setTreeWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const treeDataNodes = useMemo(() => convertToTreeData(treeData, cx), [treeData]);

  const selectedKeySet = useMemo(() => new Set(selectedKeys.map(String)), [selectedKeys]);
  const titleRender = useCallback((node: TreeDataNode) => {
    const key = String(node.key);
    const isSelected = selectedKeySet.has(key);
    const rawTitle =
      typeof node.title === 'function' ? node.title(node) : (node.title as React.ReactNode);
    return (
      <span className={cx(`resource-tree-node-content ${isSelected ? 'selected' : ''}`)}>
        {rawTitle}
      </span>
    );
  }, [selectedKeySet]);

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
    const shouldExpand = found.node.children && found.node.children.length > 0 ? found.path : found.path.slice(0, -1);
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
  }, [selectedKeys, treeData]);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCollapsed) return;
    event.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const resizeByDelta = useCallback((delta: number) => {
    if (isCollapsed) return;
    setTreeWidth((prev) => Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, prev + delta)));
  }, [isCollapsed]);

  const handleResizerKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isCollapsed) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        resizeByDelta(-16);
        break;
      case 'ArrowRight':
        event.preventDefault();
        resizeByDelta(16);
        break;
      case 'Home':
        event.preventDefault();
        setTreeWidth(MIN_TREE_WIDTH);
        break;
      case 'End':
        event.preventDefault();
        setTreeWidth(MAX_TREE_WIDTH);
        break;
      default:
        break;
    }
  }, [isCollapsed, resizeByDelta]);

  return (
    <div
      ref={containerRef}
      className={cx(`resource-tree-container ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`)}
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

      <div
        className={cx('resource-tree-resizer')}
        onMouseDown={handleResizeStart}
        onKeyDown={handleResizerKeyDown}
        onDoubleClick={() => setTreeWidth(DEFAULT_TREE_WIDTH)}
        role="separator"
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
