import React, { useRef, useState, useCallback, useMemo } from 'react';
import type { ScheduleSession } from '../../types';
import { timeToMinutes, minutesToTime } from '../../utils/scheduleUtils';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineScale } from './timeline/TimelineScale';
import { HOURS, getRestrictedSegments, getSessionSegments } from './timeline/helpers';
import styles from './TimelineVisualizer.module.css';

interface TimelineVisualizerProps {
  sessions: ScheduleSession[];
  onSessionChange?: (session: ScheduleSession) => void;
  allowedWindows?: Array<{ start: string; end: string }>;
  variant?: 'default' | 'compact';
}

type DragState = {
  isDragging: boolean;
  sessionId: string | null;
  dragType: 'start' | 'end' | 'move' | null;
  startX: number;
  originalStartMinutes: number;
  originalEndMinutes: number;
};

export const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({
  sessions,
  onSessionChange,
  allowedWindows = [],
  variant = 'default',
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    sessionId: null,
    dragType: null,
    startX: 0,
    originalStartMinutes: 0,
    originalEndMinutes: 0
  });
  const [previewState, setPreviewState] = useState<{
    sessionId: string | null;
    newStart: string | null;
    newEnd: string | null;
  }>({ sessionId: null, newStart: null, newEnd: null });

  const sortedSessions = useMemo(
    () =>
      [...(Array.isArray(sessions) ? sessions : [])]
        .filter((session) => session.enabled)
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
    [sessions]
  );

  const sessionSegments = useMemo(
    () => getSessionSegments(sortedSessions, allowedWindows),
    [sortedSessions, allowedWindows]
  );

  const restrictedSegments = useMemo(
    () => getRestrictedSegments(allowedWindows),
    [allowedWindows]
  );

  const roundToMinute = (minutes: number): number => {
    return Math.round(minutes);
  };

  const getMinutesFromX = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return roundToMinute(percentage * 1440);
  }, []);

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    session: ScheduleSession,
    type: 'start' | 'end' | 'move'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onSessionChange) return;

    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);

    setDragState({
      isDragging: true,
      sessionId: session.id,
      dragType: type,
      startX: e.clientX,
      originalStartMinutes: startMinutes,
      originalEndMinutes: endMinutes
    });
  }, [onSessionChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.sessionId || !dragState.dragType) return;

    const currentMinutes = getMinutesFromX(e.clientX);
    const segment = sessionSegments.find(s => s.session.id === dragState.sessionId);
    if (!segment) return;

    let newStartMinutes = segment.startMinutes;
    let newEndMinutes = segment.endMinutes;

    switch (dragState.dragType) {
      case 'start':
        if (currentMinutes < segment.endMinutes - 15) {
          newStartMinutes = currentMinutes;
        }
        break;
      case 'end':
        if (currentMinutes > segment.startMinutes + 15) {
          newEndMinutes = currentMinutes;
        }
        break;
      case 'move': {
        const duration = segment.duration;
        const maxStart = 1440 - duration;
        newStartMinutes = Math.max(0, Math.min(maxStart, currentMinutes - Math.floor(duration / 2)));
        newEndMinutes = newStartMinutes + duration;
        break;
      }
    }

    setPreviewState({
      sessionId: dragState.sessionId,
      newStart: minutesToTime(newStartMinutes),
      newEnd: minutesToTime(newEndMinutes % 1440)
    });
  }, [dragState, getMinutesFromX, sessionSegments]);

  const handleMouseUp = useCallback(() => {
    if (!dragState.isDragging || !dragState.sessionId || !previewState.newStart || !previewState.newEnd) {
      setDragState({
        isDragging: false,
        sessionId: null,
        dragType: null,
        startX: 0,
        originalStartMinutes: 0,
        originalEndMinutes: 0
      });
      setPreviewState({ sessionId: null, newStart: null, newEnd: null });
      return;
    }

    const segment = sessionSegments.find(s => s.session.id === dragState.sessionId);
    if (segment && onSessionChange) {
      onSessionChange({
        ...segment.session,
        start: previewState.newStart,
        end: previewState.newEnd
      });
    }

    setDragState({
      isDragging: false,
      sessionId: null,
      dragType: null,
      startX: 0,
      originalStartMinutes: 0,
      originalEndMinutes: 0
    });
    setPreviewState({ sessionId: null, newStart: null, newEnd: null });
  }, [dragState, previewState, sessionSegments, onSessionChange]);

  React.useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  const getPreviewPosition = (sessionId: string): { left: number; width: number; newStart: string; newEnd: string } | null => {
    if (previewState.sessionId !== sessionId || !previewState.newStart || !previewState.newEnd) {
      return null;
    }
    const startMinutes = timeToMinutes(previewState.newStart);
    const endMinutes = timeToMinutes(previewState.newEnd);
    let duration = endMinutes - startMinutes;
    if (duration < 0) duration += 1440;
    return {
      left: (startMinutes / 1440) * 100,
      width: (duration / 1440) * 100,
      newStart: previewState.newStart,
      newEnd: previewState.newEnd
    };
  };

  if (sortedSessions.length === 0) {
    return (
      <div
        className={[
          styles['timeline-visualizer'],
          variant === 'compact' ? styles.compact : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <TimelineHeader showLegend={false} variant={variant} />
        <div className={[styles['timeline-container'], styles.disabled].join(' ')}>
          <div className={styles['timeline-line-container']} ref={timelineRef}>
            <div className={styles['timeline-base-line']} />
            <TimelineScale hours={HOURS} />
          </div>
          <div className={styles['timeline-overlay']}>
            <span>No Sessions</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        styles['timeline-visualizer'],
        variant === 'compact' ? styles.compact : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TimelineHeader showLegend variant={variant} />

      <div className={styles['timeline-container']}>
        <div
          className={[
            styles['timeline-line-container'],
            dragState.isDragging ? styles.dragging : '',
          ]
            .filter(Boolean)
            .join(' ')}
          ref={timelineRef}
        >
          {/* Основная линия (фон) */}
          <div className={styles['timeline-base-line']} />

          {/* Отрисовка запрещенных зон (красный поверх серого) */}
          {restrictedSegments.map((seg, i) => (
            <div 
              key={i} 
              className={styles['restricted-zone-overlay']}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            />
          ))}

          {/* Активные сегменты сессий */}
          {sessionSegments.map((segment) => {
            const preview = getPreviewPosition(segment.session.id);
            const isDraggingThis = dragState.sessionId === segment.session.id;

            return (
              <div key={segment.session.id}>
                {/* Основной бар сессии */}
                <div
                  className={[
                    styles['timeline-session-bar'],
                    isDraggingThis ? styles.dragging : '',
                    segment.isRestricted
                      ? styles.restricted
                      : segment.isOverlapping
                        ? styles.overlapping
                        : '',
                    onSessionChange ? styles.draggable : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: `${segment.left}%`,
                    width: `${segment.width}%`
                  }}
                  title={`${segment.session.start} - ${segment.session.end}${segment.session.profile ? ` (${segment.session.profile})` : ''}${segment.isRestricted ? ' [RESTRICTED]' : segment.isOverlapping ? ' [OVERLAP]' : ''}`}
                  onMouseDown={(e) => handleMouseDown(e, segment.session, 'move')}
                >
                  {/* Подпись длительности сессии - только длительность по центру */}
                  {segment.width > 2 && (
                    <span className={styles['session-duration-label']}>
                      {preview ? `${preview.newStart} - ${preview.newEnd}` : `${segment.session.start} - ${segment.session.end}`}
                    </span>
                  )}
                </div>

                {/* Превью позиции при перетаскивании */}
                {preview && (
                  <div
                    className={[styles['timeline-session-bar'], styles.preview].join(' ')}
                    style={{
                      left: `${preview.left}%`,
                      width: `${preview.width}%`
                    }}
                  />
                )}
              </div>
            );
          })}

          <TimelineScale hours={HOURS} />

          {/* Точки начала и конца сессий */}
          {sessionSegments.map((segment) => {
            const isDraggingThis = dragState.sessionId === segment.session.id;
            const preview = getPreviewPosition(segment.session.id);

            let startLeft = segment.left;
            let endLeft = ((segment.startMinutes + segment.duration) / 1440) * 100;

            if (preview && isDraggingThis) {
              startLeft = preview.left;
              endLeft = preview.left + preview.width;
            }

            return (
              <React.Fragment key={`${segment.session.id}-markers`}>
                <div
                  className={[
                    styles['timeline-marker'],
                    styles.start,
                    isDraggingThis && dragState.dragType === 'start' ? styles.dragging : '',
                    onSessionChange ? styles.draggable : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ left: `${startLeft}%` }}
                  data-time={preview?.newStart || segment.session.start}
                  onMouseDown={(e) => handleMouseDown(e, segment.session, 'start')}
                />
                <div
                  className={[
                    styles['timeline-marker'],
                    styles.end,
                    isDraggingThis && dragState.dragType === 'end' ? styles.dragging : '',
                    onSessionChange ? styles.draggable : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ left: `${endLeft}%` }}
                  data-time={preview?.newEnd || segment.session.end}
                  onMouseDown={(e) => handleMouseDown(e, segment.session, 'end')}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
