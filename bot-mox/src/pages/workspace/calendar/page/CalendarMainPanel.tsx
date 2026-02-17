import React from 'react';
import { Calendar, Button, Card, Space, Tag, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { WorkspaceCalendarEvent } from '../../../../services/workspaceService';
import type { CalendarViewMode } from './types';
import styles from '../WorkspaceCalendarPage.module.css';

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
  <Card
    className={styles.main}
    loading={loading}
    styles={{
      body: {
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      },
    }}
  >
    <div className={styles.legend}>
      <Space size={16}>
        <span className={styles.legendItem}>
          <span className={styles.legendCircle} />
          Circle: events count
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendSelected} />
          Rectangle: selected day
        </span>
      </Space>
    </div>

    {calendarView === 'month' ? (
      <Calendar
        value={selectedDate}
        onSelect={onSelectDate}
        className={styles.calendar}
        cellRender={(current, info) => {
          if (info.type !== 'date') {
            return info.originNode;
          }

          const isSelected = current.isSame(selectedDate, 'day');
          const count = eventsByDate.get(current.format('YYYY-MM-DD'))?.length ?? 0;

          return (
            <div className={`${styles.cell} ${isSelected ? styles.cellSelected : ''}`}>
              {info.originNode}
              {count > 0 && <span className={styles.cellBadge}>{count}</span>}
            </div>
          );
        }}
      />
    ) : (
      <div className={styles.week}>
        <div className={styles.weekToolbar}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={() => onShiftWeek(-1)} />
            <Button onClick={() => onSelectDate(dayjs())}>Today</Button>
            <Button icon={<RightOutlined />} onClick={() => onShiftWeek(1)} />
          </Space>
          <Text type="secondary">
            {weekStart.format('DD MMM')} - {weekStart.add(6, 'day').format('DD MMM YYYY')}
          </Text>
        </div>

        <div className={styles.weekGrid}>
          {weekDays.map((day) => {
            const dayKey = day.format('YYYY-MM-DD');
            const dayEvents = eventsByDate.get(dayKey) ?? [];
            const isSelected = day.isSame(selectedDate, 'day');

            return (
              <button
                key={dayKey}
                type="button"
                className={`${styles.weekDay} ${isSelected ? styles.weekDaySelected : ''}`}
                onClick={() => onSelectDate(day)}
              >
                <div className={styles.weekDayHeader}>
                  <span>{day.format('ddd')}</span>
                  <span>{day.format('DD')}</span>
                </div>
                <div className={styles.weekDayBody}>
                  {dayEvents.length === 0 ? (
                    <Text type="secondary">No events</Text>
                  ) : (
                    <>
                      {dayEvents.slice(0, 3).map((event) => (
                        <Tag key={event.id} className={styles.weekTag}>
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
