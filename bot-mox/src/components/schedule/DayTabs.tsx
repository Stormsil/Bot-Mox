import React, { useRef, useEffect, useState } from 'react';
import type { ScheduleDay } from '../../types';
import { getDayName, formatDateShort } from '../../utils/scheduleUtils';
import styles from './DayTabs.module.css';

interface DayTabsProps {
  selectedDay: number;
  onDayChange: (day: number) => void;
  days: Record<string, ScheduleDay>;
}

// Генерируем массив дат начиная с сегодняшнего дня (18 дней)
const generateDatesFromToday = (count: number = 18): Date[] => {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date);
  }
  
  return dates;
};

export const DayTabs: React.FC<DayTabsProps> = ({
  selectedDay,
  onDayChange,
  days
}) => {
  const [carouselDates] = useState(() => generateDatesFromToday(18));
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getDayStatus = (dayIndex: number): 'active' | 'disabled' | 'empty' => {
    const dayKey = dayIndex.toString();
    const day = days[dayKey];
    
    if (!day || !day.enabled) return 'disabled';
    const sessions = Array.isArray(day.sessions) ? day.sessions : [];
    const hasSessions = sessions.some(s => s.enabled);
    
    return hasSessions ? 'active' : 'empty';
  };

  // Прокрутка к выбранному дню при смене дня
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Находим первый день с выбранным dayIndex
      const targetIndex = carouselDates.findIndex(d => d.getDay() === selectedDay);
      if (targetIndex !== -1) {
        const containerWidth = scrollContainerRef.current.clientWidth;
        const dayWidth = containerWidth / 7; // показываем 7 дней
        const scrollPosition = targetIndex * dayWidth;
        scrollContainerRef.current.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedDay, carouselDates]);

  const handleDayClick = (dayIndex: number) => {
    onDayChange(dayIndex);
  };

  // Отфильтровываем только первые 7 дней (одна неделя) для отображения
  const weekDates = carouselDates.slice(0, 7);

  return (
    <div className={styles['day-tabs-container']}>
      <div className={styles['day-tabs-carousel']} ref={scrollContainerRef}>
        {weekDates.map((date, index) => {
          const dayIndex = date.getDay(); // 0 = Sun, 1 = Mon, etc.
          const status = getDayStatus(dayIndex);
          const isSelected = selectedDay === dayIndex;
          const isToday = index === 0;

          return (
            <button
              key={index}
              className={[
                styles['day-tab'],
                isSelected ? styles.selected : '',
                styles[status],
                isToday ? styles.today : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleDayClick(dayIndex)}
            >
              <span className={styles['day-name']}>{getDayName(dayIndex, true)}</span>
              <span className={styles['day-date']}>{formatDateShort(date)}</span>
              <span className={[styles['day-indicator'], styles[status]].join(' ')} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
