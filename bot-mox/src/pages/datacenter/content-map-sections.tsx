import React from 'react';
import { Button, Card, Tag } from 'antd';
import {
  CreditCardOutlined,
  DesktopOutlined,
  DownOutlined,
  GlobalOutlined,
  KeyOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type {
  ContentMapSection,
  DatacenterLicenseProxyStats,
  DatacenterLoadingState,
  DatacenterProjectStatsState,
  DatacenterResourceStats,
  NavPropsFactory,
} from './content-map-types';
import styles from './DatacenterPage.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const mapCardStyles = {
  body: { padding: '14px 16px' },
};

function SectionToggle({
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
    <Button
      type="text"
      size="small"
      className={cx('content-map-toggle')}
      onClick={() => onToggle(section)}
      icon={collapsed ? <RightOutlined /> : <DownOutlined />}
      aria-label={collapsed ? `Expand ${readable}` : `Collapse ${readable}`}
    />
  );
}

export function ProjectsSection({
  collapsedSections,
  toggleSection,
  navProps,
  loading,
  projectStats,
}: {
  collapsedSections: Record<ContentMapSection, boolean>;
  toggleSection: (section: ContentMapSection) => void;
  navProps: NavPropsFactory;
  loading: DatacenterLoadingState;
  projectStats: DatacenterProjectStatsState;
}) {
  return (
    <div className={cx('content-map-section')}>
      <div className={cx('content-map-section-head')}>
        <div className={cx('content-map-section-title')}>Projects</div>
        <SectionToggle section="projects" collapsedSections={collapsedSections} onToggle={toggleSection} />
      </div>
      {!collapsedSections.projects && (
        <div className={cx('content-map-grid content-map-grid--projects')}>
          <Card
            className={cx('map-card map-card--clickable')}
            hoverable
            loading={loading.bots}
            styles={mapCardStyles}
            {...navProps('/project/wow_tbc')}
          >
            <div className={cx('map-card-head')}>
              <div className={cx('map-card-title')}>
                <DesktopOutlined /> WoW TBC
              </div>
              <Tag className={cx('map-card-tag')}>{projectStats.wow_tbc.total} bots</Tag>
            </div>
            <div className={cx('map-stats-row')}>
              <div className={cx('map-stat-chip map-stat-chip--active')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_tbc.active}</span>
                <span className={cx('map-stat-label')}>Active</span>
              </div>
              <div className={cx('map-stat-chip map-stat-chip--prepare')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_tbc.prepare}</span>
                <span className={cx('map-stat-label')}>Prepare</span>
              </div>
              <div className={cx('map-stat-chip map-stat-chip--offline')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_tbc.offline}</span>
                <span className={cx('map-stat-label')}>Offline</span>
              </div>
              <div className={cx('map-stat-chip map-stat-chip--banned')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_tbc.banned}</span>
                <span className={cx('map-stat-label')}>Banned</span>
              </div>
            </div>
            <div className={cx('map-card-footer')}>
              <span>Open project</span>
              <RightOutlined />
            </div>
          </Card>

          <Card
            className={cx('map-card map-card--clickable')}
            hoverable
            loading={loading.bots}
            styles={mapCardStyles}
            {...navProps('/project/wow_midnight')}
          >
            <div className={cx('map-card-head')}>
              <div className={cx('map-card-title')}>
                <DesktopOutlined /> WoW Midnight
              </div>
              <Tag className={cx('map-card-tag')}>{projectStats.wow_midnight.total} bots</Tag>
            </div>
            <div className={cx('map-stats-row')}>
              <div className={cx('map-stat-chip map-stat-chip--active')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_midnight.active}</span>
                <span className={cx('map-stat-label')}>Active</span>
              </div>
              <div className={cx('map-stat-chip map-stat-chip--prepare')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_midnight.prepare}</span>
                <span className={cx('map-stat-label')}>Prepare</span>
              </div>
              <div className={cx('map-stat-chip map-stat-chip--offline')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_midnight.offline}</span>
                <span className={cx('map-stat-label')}>Offline</span>
              </div>
              <div className={cx('map-stat-chip map-stat-chip--banned')}>
                <span className={cx('map-stat-value')}>{projectStats.wow_midnight.banned}</span>
                <span className={cx('map-stat-label')}>Banned</span>
              </div>
            </div>
            <div className={cx('map-card-footer')}>
              <span>Open project</span>
              <RightOutlined />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResourceCard({
  icon,
  title,
  tagText,
  stats,
  loading,
  navPropsValue,
  footerText,
  hasUnassigned,
}: {
  icon: React.ReactNode;
  title: string;
  tagText: string;
  stats: DatacenterResourceStats | DatacenterLicenseProxyStats;
  loading: boolean;
  navPropsValue: ReturnType<NavPropsFactory>;
  footerText: string;
  hasUnassigned?: boolean;
}) {
  return (
    <Card
      className={cx('map-card map-card--clickable')}
      hoverable
      loading={loading}
      styles={mapCardStyles}
      {...navPropsValue}
    >
      <div className={cx('map-card-head')}>
        <div className={cx('map-card-title')}>
          {icon} {title}
        </div>
        <Tag className={cx('map-card-tag')}>{tagText}</Tag>
      </div>
      <div className={cx('map-stats-row')}>
        <div className={cx('map-stat-chip map-stat-chip--active')}>
          <span className={cx('map-stat-value')}>{stats.active}</span>
          <span className={cx('map-stat-label')}>Active</span>
        </div>
        <div className={cx('map-stat-chip map-stat-chip--warning')}>
          <span className={cx('map-stat-value')}>{stats.expiringSoon}</span>
          <span className={cx('map-stat-label')}>Expiring Soon</span>
        </div>
        <div className={cx('map-stat-chip map-stat-chip--expired')}>
          <span className={cx('map-stat-value')}>{stats.expired}</span>
          <span className={cx('map-stat-label')}>Expired</span>
        </div>
        {hasUnassigned && 'unassigned' in stats && (
          <div className={cx('map-stat-chip map-stat-chip--unassigned')}>
            <span className={cx('map-stat-value')}>{stats.unassigned}</span>
            <span className={cx('map-stat-label')}>Unassigned</span>
          </div>
        )}
      </div>
      <div className={cx('map-card-footer')}>
        <span>{footerText}</span>
        <RightOutlined />
      </div>
    </Card>
  );
}

export function ResourcesSection({
  collapsedSections,
  toggleSection,
  navProps,
  loading,
  licenseStats,
  proxyStats,
  subscriptionStats,
}: {
  collapsedSections: Record<ContentMapSection, boolean>;
  toggleSection: (section: ContentMapSection) => void;
  navProps: NavPropsFactory;
  loading: DatacenterLoadingState;
  licenseStats: DatacenterLicenseProxyStats;
  proxyStats: DatacenterLicenseProxyStats;
  subscriptionStats: DatacenterResourceStats;
}) {
  return (
    <div className={cx('content-map-section')}>
      <div className={cx('content-map-section-head')}>
        <div className={cx('content-map-section-title')}>Resources</div>
        <SectionToggle section="resources" collapsedSections={collapsedSections} onToggle={toggleSection} />
      </div>
      {!collapsedSections.resources && (
        <div className={cx('content-map-grid content-map-grid--resources')}>
          <ResourceCard
            icon={<KeyOutlined />}
            title="Licenses"
            tagText={`${licenseStats.total} total`}
            stats={licenseStats}
            loading={loading.licenses}
            navPropsValue={navProps('/licenses')}
            footerText="Open licenses"
            hasUnassigned
          />
          <ResourceCard
            icon={<GlobalOutlined />}
            title="Proxies"
            tagText={`${proxyStats.total} total`}
            stats={proxyStats}
            loading={loading.proxies}
            navPropsValue={navProps('/proxies')}
            footerText="Open proxies"
            hasUnassigned
          />
          <ResourceCard
            icon={<CreditCardOutlined />}
            title="Subscriptions"
            tagText={`${subscriptionStats.total} total`}
            stats={subscriptionStats}
            loading={loading.subscriptions}
            navPropsValue={navProps('/subscriptions')}
            footerText="Open subscriptions"
          />
        </div>
      )}
    </div>
  );
}
