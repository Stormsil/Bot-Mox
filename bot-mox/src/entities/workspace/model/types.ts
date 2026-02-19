export type KanbanStatus = 'todo' | 'in_progress' | 'done';

export interface WorkspaceCalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  linked_note_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: KanbanStatus;
  due_date: string | null;
  order: number;
  created_at: number;
  updated_at: number;
}

export interface CreateCalendarEventData {
  title: string;
  description?: string;
  date: string;
  linked_note_id?: string | null;
}

export interface UpdateCalendarEventData {
  title?: string;
  description?: string;
  date?: string;
  linked_note_id?: string | null;
}

export interface CreateKanbanTaskData {
  title: string;
  description?: string;
  status?: KanbanStatus;
  due_date?: string | null;
  order?: number;
}

export interface UpdateKanbanTaskData {
  title?: string;
  description?: string;
  status?: KanbanStatus;
  due_date?: string | null;
  order?: number;
}
