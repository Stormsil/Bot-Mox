const PATH_BY_TREE_KEY: Record<string, string> = {
  datacenter: '/',
  finance: '/finance',
  settings: '/settings',
  notes: '/notes',
  workspace_calendar: '/workspace/calendar',
  workspace_kanban: '/workspace/kanban',
  licenses: '/licenses',
  proxies: '/proxies',
  subscriptions: '/subscriptions',
  vms: '/vms',
  vms_list: '/vms/list',
  vms_site_proxmox: '/vms/sites/proxmox',
  vms_site_tinyfm: '/vms/sites/tinyfm',
  vms_site_syncthing: '/vms/sites/syncthing',
};

export function resolveStaticPathForTreeKey(key: string): string | null {
  return PATH_BY_TREE_KEY[key] || null;
}
