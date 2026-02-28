export function getWeekDates(baseDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();

  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates;
}

export function getCarouselDates(baseDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();

  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates;
}

export function getCarouselDayIndex(carouselIndex: number): number {
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  return dayOrder[carouselIndex % 7];
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function getDayName(dayIndex: number, short: boolean = true): string {
  const days = short
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex];
}
