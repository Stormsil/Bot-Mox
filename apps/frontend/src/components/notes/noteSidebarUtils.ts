import { formatNoteSidebarDate } from '../../shared/lib/date';

const TAG_COLORS = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'geekblue', 'lime'];

export const formatDate = (timestamp: number): string => {
  return formatNoteSidebarDate(timestamp);
};

export const getTagColor = (tag: string): string => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};
