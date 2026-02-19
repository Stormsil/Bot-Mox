import type { ConfigureTab, MainTab, ResourcesTab } from './types';

export const MAIN_TABS: MainTab[] = ['summary', 'monitoring', 'configure', 'resources', 'vmInfo'];
export const CONFIGURE_TABS: ConfigureTab[] = ['person', 'account', 'character', 'schedule'];
export const RESOURCES_TABS: ResourcesTab[] = ['license', 'proxy', 'subscription'];

export const DEFAULT_CONFIGURE_TAB: ConfigureTab = 'person';
export const DEFAULT_RESOURCES_TAB: ResourcesTab = 'license';

export const isMainTab = (value: string | null): value is MainTab =>
  !!value && MAIN_TABS.includes(value as MainTab);

export const isConfigureTab = (value: string | null): value is ConfigureTab =>
  !!value && CONFIGURE_TABS.includes(value as ConfigureTab);

export const isResourcesTab = (value: string | null): value is ResourcesTab =>
  !!value && RESOURCES_TABS.includes(value as ResourcesTab);

export const normalizeTabParams = (params: URLSearchParams) => {
  const tabParam = params.get('tab');
  const subParam = params.get('subtab');

  if (isMainTab(tabParam)) {
    if (tabParam === 'configure') {
      return {
        main: tabParam,
        configure: isConfigureTab(subParam) ? subParam : DEFAULT_CONFIGURE_TAB,
      };
    }
    if (tabParam === 'resources') {
      return {
        main: tabParam,
        resources: isResourcesTab(subParam) ? subParam : DEFAULT_RESOURCES_TAB,
      };
    }
    return { main: tabParam };
  }

  if (isConfigureTab(tabParam)) {
    return { main: 'configure' as MainTab, configure: tabParam };
  }

  if (isResourcesTab(tabParam)) {
    return { main: 'resources' as MainTab, resources: tabParam };
  }

  if (tabParam === 'lifeStages') {
    return { main: 'monitoring' as MainTab };
  }

  return { main: 'summary' as MainTab };
};
