import { useCallback, useEffect, useState } from 'react';
import { uiLogger } from '../../observability/uiLogger';
import type { ContentMapSection } from './content-map';
import { CONTENT_MAP_COLLAPSE_KEY, DEFAULT_COLLAPSED_SECTIONS } from './page-helpers';

export function useDatacenterCurrentTime(): number {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return currentTime;
}

export function useDatacenterCollapsedSections(): {
  collapsedSections: Record<ContentMapSection, boolean>;
  toggleSection: (section: ContentMapSection) => void;
} {
  const [collapsedSections, setCollapsedSections] = useState<Record<ContentMapSection, boolean>>(
    () => {
      const saved = localStorage.getItem(CONTENT_MAP_COLLAPSE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_COLLAPSED_SECTIONS, ...JSON.parse(saved) };
        } catch (error) {
          uiLogger.warn('Failed to parse content map collapse state:', error);
        }
      }
      return DEFAULT_COLLAPSED_SECTIONS;
    },
  );

  useEffect(() => {
    localStorage.setItem(CONTENT_MAP_COLLAPSE_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  const toggleSection = useCallback((section: ContentMapSection) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  return {
    collapsedSections,
    toggleSection,
  };
}
