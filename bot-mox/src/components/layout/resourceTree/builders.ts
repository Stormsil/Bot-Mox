import type { BotRecord } from '../../../services/botsApiService';
import type { BotItem, BotStatus, StatusGroup, TreeItem } from './types';
import { formatProjectLabel, groupBotsByStatus } from './tree-utils';

interface BuildProjectsInput {
  bots: Record<string, BotRecord>;
  projectsMeta: Record<string, { id: string; name: string }>;
  visibleStatuses: BotStatus[];
}

function getBotsForProject(bots: Record<string, BotRecord>, projectId: string): BotItem[] {
  return Object.entries(bots)
    .filter(([, bot]) => bot.project_id === projectId)
    .map(([id, bot]) => ({
      id,
      key: id,
      title: `${bot.character.name} (${bot.vm?.name || 'No VM'}) - ${id.substring(0, 8)}`,
      status: bot.status,
    }));
}

function buildProjectChildren(groups: StatusGroup[], projectId: string): TreeItem[] {
  return groups.map((group) => ({
    key: `status_${projectId}_${group.key}`,
    title: `${group.title} (${group.count})`,
    type: 'status_group',
    status: group.status,
    children: group.children.map((bot) => ({
      key: bot.key,
      title: bot.title,
      type: 'bot',
      status: bot.status,
    })),
  }));
}

export function buildProjectsTreeData({
  bots,
  projectsMeta,
  visibleStatuses,
}: BuildProjectsInput): TreeItem[] {
  const projectIds = Array.from(
    new Set([
      ...Object.keys(projectsMeta),
      ...Object.values(bots)
        .map((bot) => String(bot.project_id || '').trim())
        .filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  return projectIds.map((projectId) => {
    const projectBots = getBotsForProject(bots, projectId);
    const groups = groupBotsByStatus(projectBots).filter((group) =>
      visibleStatuses.includes(group.status)
    );

    const projectName = projectsMeta[projectId]?.name || formatProjectLabel(projectId);

    return {
      key: `project_${projectId}`,
      title: `${projectName} (${projectBots.length})`,
      type: 'project',
      children: buildProjectChildren(groups, projectId),
    };
  });
}

export function buildResourcesTreeData(): TreeItem[] {
  return [
    {
      key: 'licenses',
      title: 'Licenses',
      type: 'licenses',
    },
    {
      key: 'proxies',
      title: 'Proxies',
      type: 'proxies',
    },
    {
      key: 'subscriptions',
      title: 'Subscriptions',
      type: 'subscriptions',
    },
    {
      key: 'resources_virtual_machines',
      title: 'Virtual Machines',
      type: 'folder',
      selectable: false,
      children: [
        {
          key: 'vms',
          title: 'VM Generator',
          type: 'vms',
        },
        {
          key: 'vms_list',
          title: 'VM List',
          type: 'vms_list',
        },
      ],
    },
  ];
}

interface BuildUnifiedInput {
  bots: Record<string, BotRecord>;
  projectsMeta: Record<string, { id: string; name: string }>;
  visibleStatuses: BotStatus[];
}

export function buildUnifiedTreeData({ bots, projectsMeta, visibleStatuses }: BuildUnifiedInput): TreeItem[] {
  return [
    {
      key: 'datacenter',
      title: 'Overview',
      type: 'datacenter',
    },
    {
      key: 'projects',
      title: 'Projects',
      type: 'section',
      sectionKind: 'projects',
      selectable: false,
      children: buildProjectsTreeData({ bots, projectsMeta, visibleStatuses }),
    },
    {
      key: 'resources',
      title: 'Resources',
      type: 'section',
      sectionKind: 'resources',
      selectable: false,
      children: buildResourcesTreeData(),
    },
    {
      key: 'workspace',
      title: 'Workspace',
      type: 'section',
      sectionKind: 'workspace',
      selectable: false,
      children: [
        {
          key: 'notes',
          title: 'Notes',
          type: 'notes',
        },
        {
          key: 'workspace_calendar',
          title: 'Calendar',
          type: 'workspace_calendar',
        },
        {
          key: 'workspace_kanban',
          title: 'Kanban',
          type: 'workspace_kanban',
        },
      ],
    },
    {
      key: 'finance',
      title: 'Finance',
      type: 'finance',
    },
    {
      key: 'settings',
      title: 'Settings',
      type: 'settings',
    },
  ];
}
