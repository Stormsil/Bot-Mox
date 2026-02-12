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
      className="content-map-toggle"
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
    <div className="content-map-section">
      <div className="content-map-section-head">
        <div className="content-map-section-title">Projects</div>
        <SectionToggle section="projects" collapsedSections={collapsedSections} onToggle={toggleSection} />
      </div>
      {!collapsedSections.projects && (
        <div className="content-map-grid content-map-grid--projects">
          <Card className="map-card map-card--clickable" hoverable loading={loading.bots} {...navProps('/project/wow_tbc')}>
            <div className="map-card-head">
              <div className="map-card-title">
                <DesktopOutlined /> WoW TBC
              </div>
              <Tag className="map-card-tag">{projectStats.wow_tbc.total} bots</Tag>
            </div>
            <div className="map-stats-row">
              <div className="map-stat-chip map-stat-chip--active">
                <span className="map-stat-value">{projectStats.wow_tbc.active}</span>
                <span className="map-stat-label">Active</span>
              </div>
              <div className="map-stat-chip map-stat-chip--prepare">
                <span className="map-stat-value">{projectStats.wow_tbc.prepare}</span>
                <span className="map-stat-label">Prepare</span>
              </div>
              <div className="map-stat-chip map-stat-chip--offline">
                <span className="map-stat-value">{projectStats.wow_tbc.offline}</span>
                <span className="map-stat-label">Offline</span>
              </div>
              <div className="map-stat-chip map-stat-chip--banned">
                <span className="map-stat-value">{projectStats.wow_tbc.banned}</span>
                <span className="map-stat-label">Banned</span>
              </div>
            </div>
            <div className="map-card-footer">
              <span>Open project</span>
              <RightOutlined />
            </div>
          </Card>

          <Card className="map-card map-card--clickable" hoverable loading={loading.bots} {...navProps('/project/wow_midnight')}>
            <div className="map-card-head">
              <div className="map-card-title">
                <DesktopOutlined /> WoW Midnight
              </div>
              <Tag className="map-card-tag">{projectStats.wow_midnight.total} bots</Tag>
            </div>
            <div className="map-stats-row">
              <div className="map-stat-chip map-stat-chip--active">
                <span className="map-stat-value">{projectStats.wow_midnight.active}</span>
                <span className="map-stat-label">Active</span>
              </div>
              <div className="map-stat-chip map-stat-chip--prepare">
                <span className="map-stat-value">{projectStats.wow_midnight.prepare}</span>
                <span className="map-stat-label">Prepare</span>
              </div>
              <div className="map-stat-chip map-stat-chip--offline">
                <span className="map-stat-value">{projectStats.wow_midnight.offline}</span>
                <span className="map-stat-label">Offline</span>
              </div>
              <div className="map-stat-chip map-stat-chip--banned">
                <span className="map-stat-value">{projectStats.wow_midnight.banned}</span>
                <span className="map-stat-label">Banned</span>
              </div>
            </div>
            <div className="map-card-footer">
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
    <Card className="map-card map-card--clickable" hoverable loading={loading} {...navPropsValue}>
      <div className="map-card-head">
        <div className="map-card-title">
          {icon} {title}
        </div>
        <Tag className="map-card-tag">{tagText}</Tag>
      </div>
      <div className="map-stats-row">
        <div className="map-stat-chip map-stat-chip--active">
          <span className="map-stat-value">{stats.active}</span>
          <span className="map-stat-label">Active</span>
        </div>
        <div className="map-stat-chip map-stat-chip--warning">
          <span className="map-stat-value">{stats.expiringSoon}</span>
          <span className="map-stat-label">Expiring Soon</span>
        </div>
        <div className="map-stat-chip map-stat-chip--expired">
          <span className="map-stat-value">{stats.expired}</span>
          <span className="map-stat-label">Expired</span>
        </div>
        {hasUnassigned && 'unassigned' in stats && (
          <div className="map-stat-chip map-stat-chip--unassigned">
            <span className="map-stat-value">{stats.unassigned}</span>
            <span className="map-stat-label">Unassigned</span>
          </div>
        )}
      </div>
      <div className="map-card-footer">
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
    <div className="content-map-section">
      <div className="content-map-section-head">
        <div className="content-map-section-title">Resources</div>
        <SectionToggle section="resources" collapsedSections={collapsedSections} onToggle={toggleSection} />
      </div>
      {!collapsedSections.resources && (
        <div className="content-map-grid content-map-grid--resources">
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
