import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ScheduleSession } from '../../types';
import { minutesToTime, timeToMinutes } from '../../utils/scheduleUtils';
import { getRestrictedSegments, getSessionSegments, HOURS } from './timeline/helpers';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineScale } from './timeline/TimelineScale';
import { timelineStyles as styles } from './timelineStyles';

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
};

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

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
    [sessions],
  );

  const sessionSegments = useMemo(
    () => getSessionSegments(sortedSessions, allowedWindows),
    [sortedSessions, allowedWindows],
  );

  const restrictedSegments = useMemo(() => getRestrictedSegments(allowedWindows), [allowedWindows]);

  const roundToMinute = useCallback((minutes: number): number => Math.round(minutes), []);

  const getMinutesFromX = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      return roundToMinute(percentage * 1440);
    },
    [roundToMinute],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, session: ScheduleSession, type: 'start' | 'end' | 'move') => {
      e.preventDefault();
      e.stopPropagation();

      if (!onSessionChange) return;

      setDragState({
        isDragging: true,
        sessionId: session.id,
        dragType: type,
      });
    },
    [onSessionChange],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.isDragging || !dragState.sessionId || !dragState.dragType) return;

      const currentMinutes = getMinutesFromX(e.clientX);
      const segment = sessionSegments.find((s) => s.session.id === dragState.sessionId);
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
          newStartMinutes = Math.max(
            0,
            Math.min(maxStart, currentMinutes - Math.floor(duration / 2)),
          );
          newEndMinutes = newStartMinutes + duration;
          break;
        }
      }

      setPreviewState({
        sessionId: dragState.sessionId,
        newStart: minutesToTime(newStartMinutes),
        newEnd: minutesToTime(newEndMinutes % 1440),
      });
    },
    [dragState, getMinutesFromX, sessionSegments],
  );

  const handleMouseUp = useCallback(() => {
    if (
      !dragState.isDragging ||
      !dragState.sessionId ||
      !previewState.newStart ||
      !previewState.newEnd
    ) {
      setDragState({
        isDragging: false,
        sessionId: null,
        dragType: null,
      });
      setPreviewState({ sessionId: null, newStart: null, newEnd: null });
      return;
    }

    const segment = sessionSegments.find((s) => s.session.id === dragState.sessionId);
    if (segment && onSessionChange) {
      onSessionChange({
        ...segment.session,
        start: previewState.newStart,
        end: previewState.newEnd,
      });
    }

    setDragState({
      isDragging: false,
      sessionId: null,
      dragType: null,
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

  const getPreviewPosition = (
    sessionId: string,
  ): { left: number; width: number; newStart: string; newEnd: string } | null => {
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
      newEnd: previewState.newEnd,
    };
  };

  if (sortedSessions.length === 0) {
    return (
      <div className={cx(styles['timeline-visualizer'], variant === 'compact' && styles.compact)}>
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
    <div className={cx(styles['timeline-visualizer'], variant === 'compact' && styles.compact)}>
      <TimelineHeader showLegend variant={variant} />

      <div className={styles['timeline-container']}>
        <div
          className={cx(styles['timeline-line-container'], dragState.isDragging && styles.dragging)}
          ref={timelineRef}
        >
          <div className={styles['timeline-base-line']} />

          {restrictedSegments.map((seg) => (
            <div
              key={`${seg.left}-${seg.width}`}
              className={styles['restricted-zone-overlay']}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
            />
          ))}

          {sessionSegments.map((segment) => {
            const preview = getPreviewPosition(segment.session.id);
            const isDraggingThis = dragState.sessionId === segment.session.id;

            return (
              <div key={segment.session.id}>
                <button
                  type="button"
                  className={cx(
                    styles['timeline-session-bar'],
                    isDraggingThis && styles.dragging,
                    segment.isRestricted
                      ? styles.restricted
                      : segment.isOverlapping
                        ? styles.overlapping
                        : undefined,
                    onSessionChange && styles.draggable,
                  )}
                  style={{
                    left: `${segment.left}%`,
                    width: `${segment.width}%`,
                  }}
                  title={`${segment.session.start} - ${segment.session.end}${segment.session.profile ? ` (${segment.session.profile})` : ''}${segment.isRestricted ? ' [RESTRICTED]' : segment.isOverlapping ? ' [OVERLAP]' : ''}`}
                  onMouseDown={
                    onSessionChange ? (e) => handleMouseDown(e, segment.session, 'move') : undefined
                  }
                >
                  {segment.width > 2 && (
                    <span className={styles['session-duration-label']}>
                      {preview
                        ? `${preview.newStart} - ${preview.newEnd}`
                        : `${segment.session.start} - ${segment.session.end}`}
                    </span>
                  )}
                </button>

                {preview && (
                  <div
                    className={[styles['timeline-session-bar'], styles.preview].join(' ')}
                    style={{
                      left: `${preview.left}%`,
                      width: `${preview.width}%`,
                    }}
                  />
                )}
              </div>
            );
          })}

          <TimelineScale hours={HOURS} />

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
                <button
                  type="button"
                  className={cx(
                    styles['timeline-marker'],
                    styles.start,
                    isDraggingThis && dragState.dragType === 'start' && styles.dragging,
                    onSessionChange && styles.draggable,
                  )}
                  style={{ left: `${startLeft}%` }}
                  data-time={preview?.newStart || segment.session.start}
                  onMouseDown={
                    onSessionChange
                      ? (e) => handleMouseDown(e, segment.session, 'start')
                      : undefined
                  }
                />
                <button
                  type="button"
                  className={cx(
                    styles['timeline-marker'],
                    styles.end,
                    isDraggingThis && dragState.dragType === 'end' && styles.dragging,
                    onSessionChange && styles.draggable,
                  )}
                  style={{ left: `${endLeft}%` }}
                  data-time={preview?.newEnd || segment.session.end}
                  onMouseDown={
                    onSessionChange ? (e) => handleMouseDown(e, segment.session, 'end') : undefined
                  }
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
