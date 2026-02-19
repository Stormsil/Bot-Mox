import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import { Button, Divider, Empty, List, Popconfirm, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { TableActionButton } from '../../../../components/ui/TableActionButton';
import type { WorkspaceCalendarEvent } from '../../../../entities/workspace/model/types';
import styles from '../WorkspaceCalendarPage.module.css';
import type { CalendarEventListHandlers, SidebarMode } from './types';

const { Text } = Typography;

interface CalendarEventListProps {
  events: WorkspaceCalendarEvent[];
  overdueEvents: WorkspaceCalendarEvent[];
  upcomingEvents: WorkspaceCalendarEvent[];
  sidebarMode: SidebarMode;
  selectedDateLabel: string;
  noteTitleById: Map<string, string>;
  handlers: CalendarEventListHandlers;
}

const renderSingleEventItem = (
  event: WorkspaceCalendarEvent,
  noteTitleById: Map<string, string>,
  handlers: CalendarEventListHandlers,
) => {
  const linkedNoteTitle = event.linked_note_id
    ? noteTitleById.get(event.linked_note_id) || 'Linked note'
    : null;

  return (
    <List.Item
      className={styles.sidebarListItem}
      actions={[
        event.linked_note_id ? (
          <TableActionButton
            key="note"
            icon={<FileTextOutlined />}
            onClick={() => {
              if (!event.linked_note_id) return;
              handlers.onOpenNote(event.linked_note_id);
            }}
            tooltip="Open linked note"
          />
        ) : null,
        <TableActionButton
          key="edit"
          icon={<EditOutlined />}
          onClick={() => handlers.onEdit(event)}
          tooltip="Edit event"
        />,
        <Popconfirm
          key="delete"
          title="Delete event?"
          okText="Delete"
          cancelText="Cancel"
          onConfirm={() => void handlers.onDelete(event.id)}
        >
          <TableActionButton danger icon={<DeleteOutlined />} tooltip="Delete event" />
        </Popconfirm>,
      ].filter(Boolean)}
    >
      <List.Item.Meta
        title={
          <Space size={8}>
            <span>{event.title}</span>
            <Tag
              color={dayjs(event.date).isBefore(dayjs().startOf('day'), 'day') ? 'error' : 'blue'}
            >
              {dayjs(event.date).format('DD MMM')}
            </Tag>
          </Space>
        }
        description={
          <Space direction="vertical" size={4} className={styles.itemDescription}>
            <span>{event.description || 'No description'}</span>
            {linkedNoteTitle && (
              <Button
                type="link"
                icon={<FileTextOutlined />}
                onClick={() => {
                  if (!event.linked_note_id) return;
                  handlers.onOpenNote(event.linked_note_id);
                }}
                className={styles.noteLink}
              >
                {linkedNoteTitle}
              </Button>
            )}
          </Space>
        }
      />
    </List.Item>
  );
};

const renderEventsList = (
  listEvents: WorkspaceCalendarEvent[],
  emptyText: string,
  noteTitleById: Map<string, string>,
  handlers: CalendarEventListHandlers,
) => {
  if (listEvents.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text type="secondary">{emptyText}</Text>}
      />
    );
  }

  return (
    <List
      dataSource={listEvents}
      renderItem={(event) => renderSingleEventItem(event, noteTitleById, handlers)}
    />
  );
};

export const CalendarEventList: React.FC<CalendarEventListProps> = ({
  events,
  overdueEvents,
  upcomingEvents,
  sidebarMode,
  selectedDateLabel,
  noteTitleById,
  handlers,
}) => {
  if (sidebarMode === 'day') {
    return renderEventsList(events, `No events for ${selectedDateLabel}`, noteTitleById, handlers);
  }

  return (
    <div className={styles.timeline}>
      <div>
        <div className={styles.sectionTitle}>
          <FlagOutlined /> Missed ({overdueEvents.length})
        </div>
        {renderEventsList(overdueEvents, 'No missed events', noteTitleById, handlers)}
      </div>
      <Divider className={styles.timelineDivider} />
      <div>
        <div className={styles.sectionTitle}>
          <ClockCircleOutlined /> Upcoming ({upcomingEvents.length})
        </div>
        {renderEventsList(upcomingEvents, 'No upcoming events', noteTitleById, handlers)}
      </div>
    </div>
  );
};
