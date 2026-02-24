import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BotStatus,
  DEFAULT_VISIBLE_STATUSES,
  ROOT_SECTION_KEYS,
  SHOW_FILTERS_KEY,
  sanitizeBotStatuses,
} from './types';

interface ResourceTreeSettingsQuery {
  isFetched: boolean;
  data:
    | {
        visibleStatuses?: BotStatus[];
        expandedKeys?: string[];
        showFilters?: boolean;
      }
    | null
    | undefined;
}

interface SaveResourceTreeSettingsMutation {
  mutate: (
    payload: {
      expandedKeys: string[];
      visibleStatuses: BotStatus[];
      showFilters: boolean;
      updated_at: number;
    },
    options: {
      onError: (error: unknown) => void;
    },
  ) => void;
}

interface UseResourceTreeStateOptions {
  loading: boolean;
  resourceTreeSettingsQuery: ResourceTreeSettingsQuery;
  saveResourceTreeSettingsMutation: SaveResourceTreeSettingsMutation;
}

interface ResourceTreeState {
  expandedKeys: React.Key[];
  showFilters: boolean;
  visibleStatuses: BotStatus[];
  setExpandedKeys: React.Dispatch<React.SetStateAction<React.Key[]>>;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  toggleStatus: (status: BotStatus) => void;
}

export function useResourceTreeState(options: UseResourceTreeStateOptions): ResourceTreeState {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [visibleStatuses, setVisibleStatuses] = useState<BotStatus[]>(DEFAULT_VISIBLE_STATUSES);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasRemoteSettings, setHasRemoteSettings] = useState(false);
  const lastPersistedSignatureRef = useRef<string>('');

  const buildSettingsSignature = useCallback(
    (input: {
      expandedKeys: React.Key[];
      visibleStatuses: BotStatus[];
      showFilters: boolean;
    }): string => {
      return JSON.stringify({
        expandedKeys: input.expandedKeys.map((key) => String(key)),
        visibleStatuses: input.visibleStatuses,
        showFilters: input.showFilters,
      });
    },
    [],
  );

  useEffect(() => {
    if (settingsLoaded || !options.resourceTreeSettingsQuery.isFetched) {
      return;
    }

    const data = options.resourceTreeSettingsQuery.data;
    if (data) {
      const frameId = window.requestAnimationFrame(() => {
        lastPersistedSignatureRef.current = buildSettingsSignature({
          expandedKeys: Array.isArray(data.expandedKeys) ? data.expandedKeys : [],
          visibleStatuses: Array.isArray(data.visibleStatuses) ? data.visibleStatuses : [],
          showFilters: typeof data.showFilters === 'boolean' ? data.showFilters : true,
        });
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
        setSettingsLoaded(true);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    let nextVisibleStatuses: BotStatus[] | null = null;
    let nextExpandedKeys: React.Key[] | null = null;
    let nextShowFilters: boolean | null = null;

    try {
      const savedFilters = localStorage.getItem('resourceTreeFilters');
      if (savedFilters) {
        nextVisibleStatuses = sanitizeBotStatuses(JSON.parse(savedFilters));
      }
      const savedExpanded = localStorage.getItem('resourceTreeExpanded');
      if (savedExpanded) {
        nextExpandedKeys = JSON.parse(savedExpanded);
      }
      const savedShowFilters = localStorage.getItem(SHOW_FILTERS_KEY);
      if (savedShowFilters) {
        nextShowFilters = JSON.parse(savedShowFilters);
      }
    } catch (error) {
      console.warn('Failed to parse local resource tree settings:', error);
    }

    const frameId = window.requestAnimationFrame(() => {
      lastPersistedSignatureRef.current = buildSettingsSignature({
        expandedKeys: nextExpandedKeys ?? [],
        visibleStatuses: nextVisibleStatuses ?? DEFAULT_VISIBLE_STATUSES,
        showFilters: typeof nextShowFilters === 'boolean' ? nextShowFilters : true,
      });
      if (nextVisibleStatuses) {
        setVisibleStatuses(nextVisibleStatuses);
      }
      if (nextExpandedKeys) {
        setExpandedKeys(nextExpandedKeys);
      }
      if (typeof nextShowFilters === 'boolean') {
        setShowFilters(nextShowFilters);
      }
      setSettingsLoaded(true);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    settingsLoaded,
    options.resourceTreeSettingsQuery.isFetched,
    options.resourceTreeSettingsQuery.data,
    buildSettingsSignature,
  ]);

  useEffect(() => {
    if (!settingsLoaded || hasRemoteSettings || options.loading) return;
    if (expandedKeys.length > 0) return;

    const frameId = window.requestAnimationFrame(() => {
      setExpandedKeys([...ROOT_SECTION_KEYS]);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [settingsLoaded, hasRemoteSettings, options.loading, expandedKeys.length]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const nextSignature = buildSettingsSignature({
      expandedKeys,
      visibleStatuses,
      showFilters,
    });
    if (nextSignature === lastPersistedSignatureRef.current) {
      return;
    }
    const payload = {
      expandedKeys: expandedKeys.map((key) => String(key)),
      visibleStatuses,
      showFilters,
      updated_at: Date.now(),
    };

    const timeout = setTimeout(() => {
      lastPersistedSignatureRef.current = nextSignature;
      options.saveResourceTreeSettingsMutation.mutate(payload, {
        onError: (error) => {
          console.error('Error saving resource tree settings:', error);
        },
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    settingsLoaded,
    expandedKeys,
    visibleStatuses,
    showFilters,
    buildSettingsSignature,
    options.saveResourceTreeSettingsMutation,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem('resourceTreeExpanded', JSON.stringify(expandedKeys));
      localStorage.setItem('resourceTreeFilters', JSON.stringify(visibleStatuses));
      localStorage.setItem(SHOW_FILTERS_KEY, JSON.stringify(showFilters));
    } catch (error) {
      console.warn('Failed to save local resource tree cache:', error);
    }
  }, [expandedKeys, visibleStatuses, showFilters]);

  const toggleStatus = useCallback((status: BotStatus) => {
    setVisibleStatuses((prev) =>
      prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status],
    );
  }, []);

  return {
    expandedKeys,
    showFilters,
    visibleStatuses,
    setExpandedKeys,
    setShowFilters,
    toggleStatus,
  };
}
