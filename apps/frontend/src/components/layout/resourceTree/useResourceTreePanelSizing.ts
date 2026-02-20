import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COLLAPSED_TREE_WIDTH,
  DEFAULT_TREE_WIDTH,
  MAX_TREE_WIDTH,
  MIN_TREE_WIDTH,
  RESOURCE_TREE_COLLAPSED_KEY,
  RESOURCE_TREE_WIDTH_KEY,
} from './types';

interface UseResourceTreePanelSizingResult {
  treeWidth: number;
  isCollapsed: boolean;
  isResizing: boolean;
  setTreeWidth: (value: number) => void;
  setCollapsedState: (next: boolean) => void;
  handleResizeStart: (event: React.MouseEvent<HTMLHRElement>) => void;
  handleResizerKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export function useResourceTreePanelSizing(
  containerRef: React.RefObject<HTMLDivElement | null>,
): UseResourceTreePanelSizingResult {
  const isResizingRef = useRef(false);
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

  const setCollapsedState = useCallback((next: boolean) => {
    setIsCollapsed(next);
    try {
      localStorage.setItem(RESOURCE_TREE_COLLAPSED_KEY, String(next));
    } catch (error) {
      console.warn('Failed to save resource tree collapse state:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(RESOURCE_TREE_WIDTH_KEY, String(treeWidth));
  }, [treeWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = Math.min(
        MAX_TREE_WIDTH,
        Math.max(MIN_TREE_WIDTH, event.clientX - rect.left),
      );
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
  }, [containerRef]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLHRElement>) => {
      if (isCollapsed) return;
      event.preventDefault();
      isResizingRef.current = true;
      setIsResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [isCollapsed],
  );

  const resizeByDelta = useCallback(
    (delta: number) => {
      if (isCollapsed) return;
      setTreeWidth((prev) => Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, prev + delta)));
    },
    [isCollapsed],
  );

  const handleResizerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    },
    [isCollapsed, resizeByDelta],
  );

  return {
    treeWidth,
    isCollapsed,
    isResizing,
    setTreeWidth,
    setCollapsedState,
    handleResizeStart,
    handleResizerKeyDown,
  };
}

export { COLLAPSED_TREE_WIDTH, DEFAULT_TREE_WIDTH, MAX_TREE_WIDTH, MIN_TREE_WIDTH };
