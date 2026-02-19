import { useCallback, useEffect, useMemo, useState } from 'react';

const LOG_HEIGHT_STORAGE_KEY = 'vmGeneratorLogHeight';
const LOG_DEFAULT_HEIGHT = 280;
const LOG_MIN_HEIGHT = 140;
const MAIN_MIN_HEIGHT = 220;

const WORKSPACE_SPLIT_KEY = 'vmGeneratorWorkspaceSplitRatio';
const WORKSPACE_DEFAULT_SPLIT_RATIO = 0.58;
const WORKSPACE_RESIZER_WIDTH_PX = 10;
const WORKSPACE_STACK_BREAKPOINT_PX = 1240;
const WORKSPACE_MIN_LEFT_PX = 1;
const WORKSPACE_MIN_RIGHT_PX = 1;
const RIGHT_PANEL_SIDE_PADDING_PX = 5;
const RIGHT_PANEL_TOTAL_SIDE_PADDING_PX = RIGHT_PANEL_SIDE_PADDING_PX * 2;
const QUEUE_GRID_COLUMN_COUNT = 6;
const QUEUE_GRID_GAP_COUNT = QUEUE_GRID_COLUMN_COUNT - 1;

const parseCssPixels = (value: string, fallback = 0): number => {
  const parsed = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getInitialLogHeight = (): number => {
  if (typeof window === 'undefined') {
    return LOG_DEFAULT_HEIGHT;
  }

  const stored = Number(localStorage.getItem(LOG_HEIGHT_STORAGE_KEY));
  if (!Number.isFinite(stored)) {
    return LOG_DEFAULT_HEIGHT;
  }

  return Math.max(LOG_MIN_HEIGHT, stored);
};

const getInitialSplitRatio = (): number => {
  if (typeof window === 'undefined') {
    return WORKSPACE_DEFAULT_SPLIT_RATIO;
  }

  const stored = Number(localStorage.getItem(WORKSPACE_SPLIT_KEY));
  if (!Number.isFinite(stored)) {
    return WORKSPACE_DEFAULT_SPLIT_RATIO;
  }

  return Math.min(Math.max(stored, 0), 1);
};

interface UseVmWorkspaceLayoutParams {
  workspaceLayoutRef: React.RefObject<HTMLDivElement | null>;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
}

interface UseVmWorkspaceLayoutResult {
  workspaceSplitRatio: number;
  workspaceGridTemplateColumns: string;
  isWorkspaceResizing: boolean;
  startWorkspaceResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
  logHeight: number;
  isLogResizing: boolean;
  startLogResize: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const useVmWorkspaceLayout = ({
  workspaceLayoutRef,
  workspaceRef,
}: UseVmWorkspaceLayoutParams): UseVmWorkspaceLayoutResult => {
  const [workspaceSplitRatio, setWorkspaceSplitRatio] = useState<number>(getInitialSplitRatio);
  const [isWorkspaceResizing, setIsWorkspaceResizing] = useState(false);
  const [logHeight, setLogHeight] = useState<number>(getInitialLogHeight);
  const [isLogResizing, setIsLogResizing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window === 'undefined' ? 9999 : window.innerWidth));

  const getPreferredRightPanelWidth = useCallback((): number => {
    const queuePanel = workspaceRef.current?.querySelector('.vm-queue-panel') as HTMLElement | null;
    if (!queuePanel || typeof window === 'undefined') {
      return 0;
    }

    const styles = window.getComputedStyle(queuePanel);
    const vm = parseCssPixels(styles.getPropertyValue('--vmq-col-vm'), 112);
    const storage = parseCssPixels(styles.getPropertyValue('--vmq-col-storage'), 96);
    const project = parseCssPixels(styles.getPropertyValue('--vmq-col-project'), 90);
    const resources = parseCssPixels(styles.getPropertyValue('--vmq-col-resources'), 166);
    const state = parseCssPixels(styles.getPropertyValue('--vmq-col-state'), 74);
    const remove = parseCssPixels(styles.getPropertyValue('--vmq-col-remove'), 20);
    const columns = queuePanel.querySelector('.vm-queue-columns') as HTMLElement | null;
    const gap = parseCssPixels(columns ? window.getComputedStyle(columns).columnGap : '', 8);

    const contentWidth =
      vm + storage + project + resources + state + remove + gap * QUEUE_GRID_GAP_COUNT;
    return Math.max(1, Math.ceil(contentWidth + RIGHT_PANEL_TOTAL_SIDE_PADDING_PX));
  }, [workspaceRef]);

  const clampWorkspaceSplitRatio = useCallback(
    (nextRatio: number): number => {
      const normalized = Math.min(Math.max(nextRatio, 0), 1);
      const root = workspaceLayoutRef.current;
      if (!root) {
        return normalized;
      }

      const rect = root.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || rect.width <= 0) {
        return normalized;
      }

      const usableWidth = Math.max(2, rect.width - WORKSPACE_RESIZER_WIDTH_PX);
      const minLeft = Math.max(1, Math.min(WORKSPACE_MIN_LEFT_PX, usableWidth - 1));
      const minRight = Math.max(1, Math.min(WORKSPACE_MIN_RIGHT_PX, usableWidth - minLeft));
      const workspaceGap = parseCssPixels(
        typeof window !== 'undefined' ? window.getComputedStyle(root).columnGap : '',
        0,
      );
      const totalGridGap = workspaceGap * 2;
      const desiredRightWidth = Math.max(minRight, getPreferredRightPanelWidth());
      const maxRightByContent = Math.max(
        minRight,
        ((desiredRightWidth + totalGridGap + WORKSPACE_RESIZER_WIDTH_PX) * usableWidth) /
          Math.max(1, rect.width),
      );
      const maxRight = Math.min(usableWidth - minLeft, maxRightByContent);
      const minLeftByRightLimit = Math.max(minLeft, usableWidth - maxRight);
      const maxLeft = usableWidth - minRight;
      const rawLeft = normalized * usableWidth;
      const leftPx = Math.min(Math.max(rawLeft, minLeftByRightLimit), maxLeft);
      return leftPx / usableWidth;
    },
    [getPreferredRightPanelWidth, workspaceLayoutRef],
  );

  const clampLogHeight = useCallback(
    (next: number): number => {
      const root = workspaceRef.current;
      if (!root) {
        return Math.max(LOG_MIN_HEIGHT, next);
      }

      const maxHeight = Math.max(LOG_MIN_HEIGHT, root.clientHeight - MAIN_MIN_HEIGHT);
      return Math.min(Math.max(next, LOG_MIN_HEIGHT), maxHeight);
    },
    [workspaceRef],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const normalized = clampWorkspaceSplitRatio(workspaceSplitRatio);
    localStorage.setItem(WORKSPACE_SPLIT_KEY, String(normalized));
  }, [workspaceSplitRatio, clampWorkspaceSplitRatio]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOG_HEIGHT_STORAGE_KEY, String(logHeight));
    }
  }, [logHeight]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(typeof window === 'undefined' ? 9999 : window.innerWidth);
      setLogHeight((prev) => clampLogHeight(prev));
      setWorkspaceSplitRatio((prev) => clampWorkspaceSplitRatio(prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampLogHeight, clampWorkspaceSplitRatio]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const startLogResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();

      const startY = event.clientY;
      const startHeight = logHeight;
      setIsLogResizing(true);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const nextHeight = startHeight + (startY - moveEvent.clientY);
        setLogHeight(clampLogHeight(nextHeight));
      };

      const handleMouseUp = () => {
        setIsLogResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [clampLogHeight, logHeight],
  );

  const startWorkspaceResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const root = workspaceLayoutRef.current;
      if (!root) {
        return;
      }

      const initialRect = root.getBoundingClientRect();
      if (!Number.isFinite(initialRect.width) || initialRect.width <= 0) {
        return;
      }

      setIsWorkspaceResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const liveRect = root.getBoundingClientRect();
        if (!Number.isFinite(liveRect.width) || liveRect.width <= 0) {
          return;
        }

        const usableWidth = Math.max(2, liveRect.width - WORKSPACE_RESIZER_WIDTH_PX);
        const rawLeft = moveEvent.clientX - liveRect.left - WORKSPACE_RESIZER_WIDTH_PX / 2;
        const nextRatio = rawLeft / usableWidth;
        setWorkspaceSplitRatio(clampWorkspaceSplitRatio(nextRatio));
      };

      const handleMouseUp = () => {
        setIsWorkspaceResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [clampWorkspaceSplitRatio, workspaceLayoutRef],
  );

  const workspaceGridTemplateColumns = useMemo(() => {
    if (viewportWidth <= WORKSPACE_STACK_BREAKPOINT_PX) {
      return '1fr';
    }
    const splitPercent = Math.max(0, Math.min(100, workspaceSplitRatio * 100));
    return `minmax(${WORKSPACE_MIN_LEFT_PX}px, ${splitPercent}%) ${WORKSPACE_RESIZER_WIDTH_PX}px minmax(${WORKSPACE_MIN_RIGHT_PX}px, 1fr)`;
  }, [workspaceSplitRatio, viewportWidth]);

  return {
    workspaceSplitRatio,
    workspaceGridTemplateColumns,
    isWorkspaceResizing,
    startWorkspaceResize,
    logHeight,
    isLogResizing,
    startLogResize,
  };
};
