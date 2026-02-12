import React, { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Segmented, Space, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  subscribeToCalendarEvents,
  type WorkspaceCalendarEvent,
  updateCalendarEvent,
} from '../../../services/workspaceService';
import { subscribeToNotesIndex, type NoteIndex } from '../../../services/notesService';
import {
  CALENDAR_VIEW_STORAGE_KEY,
  CalendarEventList,
  CalendarEventModal,
  CalendarMainPanel,
  getInitialCalendarView,
  getWeekStart,
  mapEventsByDate,
} from './page';
import type { CalendarEventFormValues, CalendarViewMode, SidebarMode } from './page';
import './WorkspaceCalendarPage.css';

const { Title } = Typography;

export const WorkspaceCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<WorkspaceCalendarEvent[]>([]);
  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<WorkspaceCalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [calendarView, setCalendarView] = useState<CalendarViewMode>(getInitialCalendarView);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('timeline');
  const [form] = Form.useForm<CalendarEventFormValues>();

  useEffect(() => {
    const unsubscribe = subscribeToCalendarEvents(
      (nextEvents) => {
        setEvents(nextEvents);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to calendar events:', error);
        message.error('Failed to load calendar events');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotesIndex(setNotes);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, calendarView);
  }, [calendarView]);

  const eventsByDate = useMemo(() => mapEventsByDate(events), [events]);
  const selectedDateKey = selectedDate.format('YYYY-MM-DD');
  const selectedDateEvents = useMemo(
    () => eventsByDate.get(selectedDateKey) ?? [],
    [eventsByDate, selectedDateKey]
  );

  const overdueEvents = useMemo(
    () =>
      events
        .filter((event) => dayjs(event.date).isBefore(dayjs().startOf('day'), 'day'))
        .sort((a, b) => {
          if (a.date === b.date) return b.updated_at - a.updated_at;
          return b.date.localeCompare(a.date);
        }),
    [events]
  );

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => !dayjs(event.date).isBefore(dayjs().startOf('day'), 'day'))
        .sort((a, b) => {
          if (a.date === b.date) return b.updated_at - a.updated_at;
          return a.date.localeCompare(b.date);
        }),
    [events]
  );

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day')),
    [weekStart]
  );

  const noteTitleById = useMemo(
    () => new Map(notes.map((note) => [note.id, note.title])),
    [notes]
  );

  const noteOptions = useMemo(
    () =>
      notes.map((note) => ({
        label: note.title || 'Untitled note',
        value: note.id,
      })),
    [notes]
  );

  const openNote = (noteId: string) => {
    navigate(`/notes?note=${encodeURIComponent(noteId)}`);
  };

  const openCreateModal = (initialDate?: Dayjs) => {
    setEditingEvent(null);
    form.setFieldsValue({
      title: '',
      description: '',
      date: initialDate ?? selectedDate,
      linked_note_id: undefined,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (event: WorkspaceCalendarEvent) => {
    setEditingEvent(event);
    form.setFieldsValue({
      title: event.title,
      description: event.description,
      date: dayjs(event.date, 'YYYY-MM-DD'),
      linked_note_id: event.linked_note_id ?? undefined,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        title: values.title.trim(),
        description: values.description?.trim() ?? '',
        date: values.date.format('YYYY-MM-DD'),
        linked_note_id: values.linked_note_id ?? null,
      };

      if (editingEvent) {
        await updateCalendarEvent(editingEvent.id, payload);
        message.success('Event updated');
      } else {
        await createCalendarEvent(payload);
        message.success('Event created');
      }

      setSelectedDate(values.date);
      setSidebarMode('day');
      closeModal();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in (error as object)) {
        return;
      }
      console.error('Failed to save calendar event:', error);
      message.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteCalendarEvent(eventId);
      message.success('Event deleted');
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      message.error('Failed to delete event');
    }
  };

  const setDayFilter = (value: Dayjs) => {
    setSelectedDate(value);
    setSidebarMode('day');
  };

  const isDayMode = sidebarMode === 'day';
  const sidebarTitle = isDayMode
    ? `Events for ${selectedDate.format('DD.MM.YYYY')}`
    : 'Missed + Upcoming';

  return (
    <div className="workspace-calendar-page">
      <div className="workspace-calendar-header">
        <Title level={4} className="workspace-calendar-title">
          <CalendarOutlined /> Workspace Calendar
        </Title>
        <Space>
          <Segmented<CalendarViewMode>
            value={calendarView}
            onChange={(value) => setCalendarView(value)}
            options={[
              { label: 'Month', value: 'month' },
              { label: 'Week', value: 'week' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
            Add event
          </Button>
        </Space>
      </div>

      <div className="workspace-calendar-layout">
        <CalendarMainPanel
          loading={loading}
          calendarView={calendarView}
          selectedDate={selectedDate}
          eventsByDate={eventsByDate}
          weekStart={weekStart}
          weekDays={weekDays}
          onSelectDate={setDayFilter}
          onShiftWeek={(delta) =>
            setSelectedDate((prev) => (delta > 0 ? prev.add(delta, 'week') : prev.subtract(Math.abs(delta), 'week')))
          }
        />

        <Card
          className="workspace-calendar-sidebar"
          title={sidebarTitle}
          extra={
            <Space>
              {isDayMode && (
                <Button size="small" onClick={() => setSidebarMode('timeline')}>
                  Show all
                </Button>
              )}
              <Button size="small" icon={<PlusOutlined />} onClick={() => openCreateModal(selectedDate)}>
                New
              </Button>
            </Space>
          }
          loading={loading}
        >
          <CalendarEventList
            events={selectedDateEvents}
            overdueEvents={overdueEvents}
            upcomingEvents={upcomingEvents}
            sidebarMode={sidebarMode}
            selectedDateLabel={selectedDate.format('DD.MM.YYYY')}
            noteTitleById={noteTitleById}
            handlers={{
              onOpenNote: openNote,
              onEdit: openEditModal,
              onDelete: handleDelete,
            }}
          />
        </Card>
      </div>

      <CalendarEventModal
        open={isModalOpen}
        editing={Boolean(editingEvent)}
        saving={saving}
        form={form}
        noteOptions={noteOptions}
        onSave={handleSave}
        onCancel={closeModal}
      />
    </div>
  );
};

export default WorkspaceCalendarPage;
