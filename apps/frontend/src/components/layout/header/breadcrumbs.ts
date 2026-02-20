import type { BotRecord } from '../../../entities/bot/model/types';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BotBreadcrumbData {
  project_id?: string;
  status?: string;
  last_seen?: number;
  name?: string;
  character?: {
    name?: string;
  };
  vm?: {
    name?: string;
  };
}

export interface BotBreadcrumbContext {
  botId: string;
  projectId?: string;
  projectLabel?: string;
  statusLabel?: string;
  label?: string;
}

const projectLabelMap: Record<string, string> = {
  wow_tbc: 'WoW TBC',
  wow_midnight: 'WoW Midnight',
};

const statusLabelMap: Record<string, string> = {
  offline: 'Offline',
  prepare: 'Prepare',
  leveling: 'Leveling',
  profession: 'Profession',
  farming: 'Farming',
  banned: 'Banned',
};

const tabLabelMap: Record<string, string> = {
  summary: 'Summary',
  monitoring: 'Monitoring',
  configure: 'Configure',
  resources: 'Resources',
  vmInfo: 'VM Info',
  transactions: 'Transactions',
  gold_price: 'Gold Price',
};

const subTabLabelMap: Record<string, string> = {
  schedule: 'Schedule',
  account: 'Account',
  character: 'Character',
  person: 'Person',
  license: 'License',
  proxy: 'Proxy',
  subscription: 'Subscription',
};

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

function formatStatusLabel(status?: string): string | undefined {
  if (!status) return undefined;
  return statusLabelMap[status] || `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function computeBotStatus(bot: BotBreadcrumbData): string | undefined {
  if (bot.status === 'banned') return 'banned';
  if (typeof bot.last_seen === 'number' && Date.now() - bot.last_seen > OFFLINE_THRESHOLD_MS) {
    return 'offline';
  }
  return bot.status;
}

export function buildBotContext(
  activeBotId: string,
  botData: BotRecord | null | undefined,
  hasError: boolean,
): BotBreadcrumbContext | null {
  if (!activeBotId) {
    return null;
  }

  const fallback: BotBreadcrumbContext = {
    botId: activeBotId,
    label: `Bot ${activeBotId.slice(0, 8)}`,
  };

  if (hasError) {
    return fallback;
  }

  const bot = botData;
  if (!bot) {
    return fallback;
  }

  const projectId = bot.project_id;
  const projectLabel = projectId ? projectLabelMap[projectId] || projectId : undefined;
  const status = computeBotStatus(bot);
  const statusLabel = formatStatusLabel(status);
  const displayName = bot.character?.name || bot.name || bot.vm?.name || 'Bot';
  const vmName = bot.vm?.name || 'VM';
  const label = `${displayName} (${vmName})_${activeBotId.slice(0, 8)}`;

  return {
    botId: activeBotId,
    projectId,
    projectLabel,
    statusLabel,
    label,
  };
}

export function buildBreadcrumbs(
  pathname: string,
  search: string,
  botContext: BotBreadcrumbContext | null,
): BreadcrumbItem[] {
  const searchParams = new URLSearchParams(search);
  const tabKey = searchParams.get('tab') || undefined;
  const subTabKey = searchParams.get('subtab') || undefined;
  let tabLabel = tabKey ? tabLabelMap[tabKey] || undefined : undefined;
  let subTabLabel = subTabKey ? subTabLabelMap[subTabKey] || subTabKey : undefined;

  if (!tabLabel && tabKey && subTabLabelMap[tabKey]) {
    subTabLabel = subTabLabelMap[tabKey];
    if (['schedule', 'account', 'character', 'person'].includes(tabKey)) {
      tabLabel = tabLabelMap.configure;
    } else if (['license', 'proxy', 'subscription'].includes(tabKey)) {
      tabLabel = tabLabelMap.resources;
    }
  }

  if (!tabLabel && tabKey === 'lifeStages') {
    tabLabel = tabLabelMap.monitoring;
  }
  if (pathname === '/') {
    return [{ label: 'Overview' }];
  }
  if (pathname.startsWith('/project/')) {
    const projectId = pathname.replace('/project/', '');
    const projectStatus = formatStatusLabel(searchParams.get('status') || undefined);
    return [
      { label: 'Projects', to: '/' },
      { label: projectLabelMap[projectId] || projectId },
      ...(projectStatus ? [{ label: projectStatus }] : []),
    ];
  }
  if (pathname.startsWith('/bot/')) {
    const botId = pathname.replace('/bot/', '');
    const botLabel = botContext?.label || `Bot ${botId.slice(0, 8)}`;
    const projectCrumb = botContext?.projectId
      ? {
          label: botContext.projectLabel || botContext.projectId,
          to: `/project/${botContext.projectId}`,
        }
      : null;
    const statusCrumb = botContext?.statusLabel ? { label: botContext.statusLabel } : null;
    return [
      { label: 'Projects', to: '/' },
      ...(projectCrumb ? [projectCrumb] : []),
      ...(statusCrumb ? [statusCrumb] : []),
      { label: botLabel },
      ...(tabLabel ? [{ label: tabLabel }] : []),
      ...(subTabLabel ? [{ label: subTabLabel }] : []),
    ];
  }
  if (pathname.startsWith('/licenses')) {
    return [{ label: 'Resources' }, { label: 'Licenses' }];
  }
  if (pathname.startsWith('/proxies')) {
    return [{ label: 'Resources' }, { label: 'Proxies' }];
  }
  if (pathname.startsWith('/subscriptions')) {
    return [{ label: 'Resources' }, { label: 'Subscriptions' }];
  }
  if (pathname.startsWith('/vms/list')) {
    return [{ label: 'Resources' }, { label: 'Virtual Machines' }, { label: 'VM List' }];
  }
  if (pathname.startsWith('/vms/sites/proxmox') || pathname.startsWith('/vms/proxmox')) {
    return [
      { label: 'Resources' },
      { label: 'Virtual Machines' },
      { label: 'Sites' },
      { label: 'Proxmox' },
    ];
  }
  if (pathname.startsWith('/vms/sites/tinyfm') || pathname.startsWith('/vms/tinyfm')) {
    return [
      { label: 'Resources' },
      { label: 'Virtual Machines' },
      { label: 'Sites' },
      { label: 'TinyFileManager' },
    ];
  }
  if (pathname.startsWith('/vms/sites/syncthing') || pathname.startsWith('/vms/syncthing')) {
    return [
      { label: 'Resources' },
      { label: 'Virtual Machines' },
      { label: 'Sites' },
      { label: 'SyncThing' },
    ];
  }
  if (pathname.startsWith('/vms/sites')) {
    return [{ label: 'Resources' }, { label: 'Virtual Machines' }, { label: 'Sites' }];
  }
  if (pathname.startsWith('/vms')) {
    return [{ label: 'Resources' }, { label: 'Virtual Machines' }, { label: 'VM Generator' }];
  }
  if (pathname.startsWith('/notes/reminders')) {
    return [{ label: 'Workspace' }, { label: 'Calendar & Reminders' }];
  }
  if (pathname.startsWith('/notes')) {
    return [{ label: 'Workspace' }, { label: 'Notes' }];
  }
  if (pathname.startsWith('/finance')) {
    return [{ label: 'Finance' }];
  }
  if (pathname.startsWith('/settings')) {
    return [{ label: 'Settings' }];
  }
  if (pathname.startsWith('/archive')) {
    return [
      { label: 'Projects', to: '/' },
      { label: 'Archive', to: '/archive/banned' },
      { label: 'Banned History' },
    ];
  }
  return [{ label: 'Overview' }];
}
