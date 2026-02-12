import React from 'react';
import { Calendar, Button, Card, Space, Tag, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { WorkspaceCalendarEvent } from '../../../../services/workspaceService';
import type { CalendarViewMode } from './types';

const { Text } = Typography;

interface CalendarMainPanelProps {
  loading: boolean;
  calendarView: CalendarViewMode;
  selectedDate: Dayjs;
  eventsByDate: Map<string, WorkspaceCalendarEvent[]>;
  weekStart: Dayjs;
  weekDays: Dayjs[];
  onSelectDate: (value: Dayjs) => void;
  onShiftWeek: (delta: number) => void;
}

export const CalendarMainPanel: React.FC<CalendarMainPanelProps> = ({
  loading,
  calendarView,
  selectedDate,
  eventsByDate,
  weekStart,
  weekDays,
  onSelectDate,
  onShiftWeek,
}) => (
  <Card className="workspace-calendar-main" loading={loading}>
    <div className="workspace-calendar-legend">
      <Space size={16}>
        <span className="workspace-calendar-legend-item">
          <span className="workspace-calendar-legend-circle" />
          Circle: events count
        </span>
        <span className="workspace-calendar-legend-item">
          <span className="workspace-calendar-legend-selected" />
          Rectangle: selected day
        </span>
      </Space>
    </div>

    {calendarView === 'month' ? (
      <Calendar
        value={selectedDate}
        onSelect={onSelectDate}
        cellRender={(current, info) => {
          if (info.type !== 'date') {
            return info.originNode;
          }
          const count = eventsByDate.get(current.format('YYYY-MM-DD'))?.length ?? 0;
          if (count === 0) {
            return info.originNode;
          }

          return (
            <div className="workspace-calendar-cell">
              {info.originNode}
              <span className="workspace-calendar-cell-badge">{count}</span>
            </div>
          );
        }}
      />
    ) : (
      <div className="workspace-calendar-week">
        <div className="workspace-calendar-week-toolbar">
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => onShiftWeek(-1)} />
            <Button onClick={() => onSelectDate(dayjs())}>Today</Button>
            <Button icon={<RightOutlined />} onClick={() => onShiftWeek(1)} />
          </Space>
          <Text type="secondary">
            {weekStart.format('DD MMM')} - {weekStart.add(6, 'day').format('DD MMM YYYY')}
          </Text>
        </div>

        <div className="workspace-calendar-week-grid">
          {weekDays.map((day) => {
            const dayKey = day.format('YYYY-MM-DD');
            const dayEvents = eventsByDate.get(dayKey) ?? [];
            const isSelected = day.isSame(selectedDate, 'day');

            return (
              <button
                key={dayKey}
                type="button"
                className={`workspace-calendar-week-day ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectDate(day)}
              >
                <div className="workspace-calendar-week-day-header">
                  <span>{day.format('ddd')}</span>
                  <span>{day.format('DD')}</span>
                </div>
                <div className="workspace-calendar-week-day-body">
                  {dayEvents.length === 0 ? (
                    <Text type="secondary">No events</Text>
                  ) : (
                    <>
                      {dayEvents.slice(0, 3).map((event) => (
                        <Tag key={event.id} className="workspace-calendar-week-tag">
                          {event.title}
                        </Tag>
                      ))}
                      {dayEvents.length > 3 && <Text type="secondary">+{dayEvents.length - 3} more</Text>}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}
  </Card>
);
