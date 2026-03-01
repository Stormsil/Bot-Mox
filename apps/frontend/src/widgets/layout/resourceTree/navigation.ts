const PATH_BY_TREE_KEY: Record<string, string> = {
  datacenter: '/',
  finance: '/finance',
  billing: '/billing',
  settings: '/settings',
  notes: '/notes',
  workspace_calendar: '/workspace/calendar',
  workspace_kanban: '/workspace/kanban',
  licenses: '/licenses',
  proxies: '/proxies',
  subscriptions: '/subscriptions',
  vms: '/vms',
  vms_list: '/vms',
  vms_unattend_profiles: '/vms',
};

export function resolveStaticPathForTreeKey(key: string): string | null {
  return PATH_BY_TREE_KEY[key] || null;
}
