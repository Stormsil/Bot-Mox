import {
  createWorkspaceCalendarViaContract,
  createWorkspaceKanbanViaContract,
  deleteWorkspaceCalendarViaContract,
  deleteWorkspaceKanbanViaContract,
  listWorkspaceCalendarViaContract,
  listWorkspaceKanbanViaContract,
  patchWorkspaceCalendarViaContract,
  patchWorkspaceKanbanViaContract,
} from '../../../providers/workspace-contract-client';
import type {
  CreateCalendarEventData,
  CreateKanbanTaskData,
  KanbanStatus,
  KanbanTask,
  UpdateCalendarEventData,
  UpdateKanbanTaskData,
  WorkspaceCalendarEvent,
} from '../model/types';

const PAGE_LIMIT = 200;
const MAX_PAGE_COUNT = 50;

type WorkspaceKind = 'calendar' | 'kanban';

interface WorkspaceCalendarEventDb {
  id?: string;
  title?: string;
  description?: string;
  date?: string;
  linked_note_id?: string | null;
  created_at?: number;
  updated_at?: number;
}

interface KanbanTaskDb {
  id?: string;
  title?: string;
  description?: string;
  status?: KanbanStatus;
  due_date?: string | null;
  order?: number;
  created_at?: number;
  updated_at?: number;
}

const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeCalendarEvent = (raw: WorkspaceCalendarEventDb): WorkspaceCalendarEvent | null => {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const now = Date.now();
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled event',
    description: typeof raw.description === 'string' ? raw.description : '',
    date:
      typeof raw.date === 'string' && isIsoDate(raw.date)
        ? raw.date
        : new Date(now).toISOString().slice(0, 10),
    linked_note_id: typeof raw.linked_note_id === 'string' ? raw.linked_note_id : null,
    created_at: typeof raw.created_at === 'number' ? raw.created_at : now,
    updated_at: typeof raw.updated_at === 'number' ? raw.updated_at : now,
  };
};

const normalizeKanbanTask = (raw: KanbanTaskDb): KanbanTask | null => {
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return null;

  const now = Date.now();
  const status: KanbanStatus =
    raw.status === 'todo' || raw.status === 'in_progress' || raw.status === 'done'
      ? raw.status
      : 'todo';

  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled task',
    description: typeof raw.description === 'string' ? raw.description : '',
    status,
    due_date: typeof raw.due_date === 'string' && isIsoDate(raw.due_date) ? raw.due_date : null,
    order: typeof raw.order === 'number' ? raw.order : now,
    created_at: typeof raw.created_at === 'number' ? raw.created_at : now,
    updated_at: typeof raw.updated_at === 'number' ? raw.updated_at : now,
  };
};

async function fetchWorkspacePage(
  kind: WorkspaceKind,
  page: number,
): Promise<{ items: unknown[]; total: number }> {
  const query = {
    page,
    limit: PAGE_LIMIT,
    sort: 'updated_at',
    order: 'desc',
  } as const;

  const response =
    kind === 'calendar'
      ? await listWorkspaceCalendarViaContract(query)
      : await listWorkspaceKanbanViaContract(query);
  const items = Array.isArray(response.data) ? response.data : [];

  const meta = asRecord(response.meta);
  const totalRaw = meta.total;
  const total = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : items.length;

  return { items, total };
}

async function fetchWorkspaceItems(kind: WorkspaceKind): Promise<unknown[]> {
  const all: unknown[] = [];

  for (let page = 1; page <= MAX_PAGE_COUNT; page += 1) {
    const { items, total } = await fetchWorkspacePage(kind, page);
    all.push(...items);

    if (items.length === 0) break;
    if (all.length >= total) break;
    if (items.length < PAGE_LIMIT) break;
  }

  return all;
}

export async function createCalendarEvent(data: CreateCalendarEventData): Promise<string> {
  if (!data.title?.trim()) {
    throw new Error('Event title is required');
  }
  if (!isIsoDate(data.date)) {
    throw new Error('Event date must be in YYYY-MM-DD format');
  }

  const now = Date.now();
  const payload = {
    title: data.title.trim(),
    description: data.description?.trim() ?? '',
    date: data.date,
    linked_note_id: data.linked_note_id ?? null,
    created_at: now,
    updated_at: now,
  };

  const response = await createWorkspaceCalendarViaContract(payload);
  const created = normalizeCalendarEvent((response.data || {}) as WorkspaceCalendarEventDb);
  if (!created) {
    throw new Error('Failed to create calendar event');
  }
  return created.id;
}

export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEventData,
): Promise<void> {
  const updates: WorkspaceCalendarEventDb = {
    updated_at: Date.now(),
  };
  if (typeof data.title === 'string') updates.title = data.title.trim();
  if (typeof data.description === 'string') updates.description = data.description.trim();
  if (typeof data.date === 'string') {
    if (!isIsoDate(data.date)) {
      throw new Error('Event date must be in YYYY-MM-DD format');
    }
    updates.date = data.date;
  }
  if (data.linked_note_id !== undefined) {
    updates.linked_note_id = data.linked_note_id;
  }

  await patchWorkspaceCalendarViaContract(String(id), { ...updates });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await deleteWorkspaceCalendarViaContract(String(id));
}

export async function fetchCalendarEvents(): Promise<WorkspaceCalendarEvent[]> {
  const rawItems = await fetchWorkspaceItems('calendar');
  return rawItems
    .map((item) => normalizeCalendarEvent(item as WorkspaceCalendarEventDb))
    .filter((item): item is WorkspaceCalendarEvent => Boolean(item))
    .sort((a, b) => {
      if (a.date === b.date) return b.updated_at - a.updated_at;
      return a.date.localeCompare(b.date);
    });
}

export async function createKanbanTask(data: CreateKanbanTaskData): Promise<string> {
  if (!data.title?.trim()) {
    throw new Error('Task title is required');
  }
  if (data.due_date && !isIsoDate(data.due_date)) {
    throw new Error('Task due_date must be in YYYY-MM-DD format');
  }

  const now = Date.now();
  const payload: Omit<KanbanTask, 'id'> = {
    title: data.title.trim(),
    description: data.description?.trim() ?? '',
    status: data.status ?? 'todo',
    due_date: data.due_date ?? null,
    order: typeof data.order === 'number' ? data.order : now,
    created_at: now,
    updated_at: now,
  };

  const response = await createWorkspaceKanbanViaContract(payload);
  const created = normalizeKanbanTask((response.data || {}) as KanbanTaskDb);
  if (!created) {
    throw new Error('Failed to create kanban task');
  }
  return created.id;
}

export async function updateKanbanTask(id: string, data: UpdateKanbanTaskData): Promise<void> {
  const updates: KanbanTaskDb = {
    updated_at: Date.now(),
  };
  if (typeof data.title === 'string') updates.title = data.title.trim();
  if (typeof data.description === 'string') updates.description = data.description.trim();
  if (data.status) updates.status = data.status;
  if (data.due_date !== undefined) {
    if (data.due_date !== null && !isIsoDate(data.due_date)) {
      throw new Error('Task due_date must be in YYYY-MM-DD format');
    }
    updates.due_date = data.due_date;
  }
  if (typeof data.order === 'number') updates.order = data.order;

  await patchWorkspaceKanbanViaContract(String(id), { ...updates });
}

export async function deleteKanbanTask(id: string): Promise<void> {
  await deleteWorkspaceKanbanViaContract(String(id));
}

export async function fetchKanbanTasks(): Promise<KanbanTask[]> {
  const rawItems = await fetchWorkspaceItems('kanban');
  return rawItems
    .map((item) => normalizeKanbanTask(item as KanbanTaskDb))
    .filter((item): item is KanbanTask => Boolean(item))
    .sort((a, b) => {
      if (a.status === b.status) return a.order - b.order || b.updated_at - a.updated_at;
      return a.status.localeCompare(b.status);
    });
}
