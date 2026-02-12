import type { Dayjs } from 'dayjs';
import type { WorkspaceCalendarEvent } from '../../../../services/workspaceService';

export interface CalendarEventFormValues {
  title: string;
  description?: string;
  date: Dayjs;
  linked_note_id?: string;
}

export type CalendarViewMode = 'month' | 'week';
export type SidebarMode = 'timeline' | 'day';

export interface CalendarEventListHandlers {
  onOpenNote: (noteId: string) => void;
  onEdit: (event: WorkspaceCalendarEvent) => void;
  onDelete: (eventId: string) => Promise<void>;
}
