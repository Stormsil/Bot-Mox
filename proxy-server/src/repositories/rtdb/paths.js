const RTDB_PATHS = {
  tenantsRoot: 'tenants',
  bots: 'bots',
  archive: 'archive',
  settings: 'settings',
  logs: {
    vmGeneratorTasks: 'logs/vm_generator/tasks',
    botLifecycle: 'logs/bot_lifecycle',
  },
  resources: {
    licenses: 'resources/licenses',
    proxies: 'resources/proxies',
    subscriptions: 'resources/subscriptions',
    virtualMachines: 'resources/virtual_machines',
  },
  finance: {
    operations: 'finance/operations',
    dailyStats: 'finance/daily_stats',
    goldPriceHistory: 'finance/gold_price_history',
  },
  workspace: {
    notes: 'workspace/notes_v2',
    calendar: 'workspace/calendar_events',
    kanban: 'workspace/kanban_tasks',
  },
};

module.exports = {
  RTDB_PATHS,
};
