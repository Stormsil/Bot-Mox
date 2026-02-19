import React from 'react';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { ContentMapSection } from './content-map-types';
import { cx } from './datacenterUi';

export function SectionToggle({
  section,
  collapsedSections,
  onToggle,
}: {
  section: ContentMapSection;
  collapsedSections: Record<ContentMapSection, boolean>;
  onToggle: (section: ContentMapSection) => void;
}) {
  const collapsed = collapsedSections[section];
  const readable = section.replace('_', ' ');

  return (
    <button
      type="button"
      className={cx('content-map-toggle')}
      onClick={() => onToggle(section)}
      aria-label={collapsed ? `Expand ${readable}` : `Collapse ${readable}`}
    >
      {collapsed ? <RightOutlined /> : <DownOutlined />}
    </button>
  );
}

