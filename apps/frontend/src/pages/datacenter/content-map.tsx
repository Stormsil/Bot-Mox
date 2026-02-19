import { Typography } from 'antd';
import type React from 'react';
import { ProjectsSection, ResourcesSection } from './content-map-sections';
import { ExpiringSection, FinanceNotesSection } from './content-map-sections-secondary';
import type {
  ContentMapSection,
  DatacenterLicenseProxyStats,
  DatacenterLoadingState,
  DatacenterProjectStatsState,
  DatacenterResourceStats,
  ExpiringItem,
  NavPropsFactory,
} from './content-map-types';
import { cx } from './datacenterUi';

const { Title, Text } = Typography;

interface DatacenterContentMapProps {
  collapsedSections: Record<ContentMapSection, boolean>;
  toggleSection: (section: ContentMapSection) => void;
  navProps: NavPropsFactory;
  loading: DatacenterLoadingState;
  projectStats: DatacenterProjectStatsState;
  licenseStats: DatacenterLicenseProxyStats;
  proxyStats: DatacenterLicenseProxyStats;
  subscriptionStats: DatacenterResourceStats;
  financeWindowDays: number;
  financeSummary: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  financeGoldByProject: {
    wow_tbc: { totalGold: number; avgPrice: number };
    wow_midnight: { totalGold: number; avgPrice: number };
  };
  notesStats: {
    total: number;
    pinned: number;
  };
  latestNotes: Array<{
    id: string;
    title?: string;
  }>;
  expiringItems: ExpiringItem[];
}

export const DatacenterContentMap: React.FC<DatacenterContentMapProps> = ({
  collapsedSections,
  toggleSection,
  navProps,
  loading,
  projectStats,
  licenseStats,
  proxyStats,
  subscriptionStats,
  financeWindowDays,
  financeSummary,
  financeGoldByProject,
  notesStats,
  latestNotes,
  expiringItems,
}) => {
  return (
    <div className={cx('content-map')}>
      <div className={cx('content-map-header')}>
        <div>
          <Title level={4} style={{ margin: 0 }} className={cx('content-map-title')}>
            Content Map
          </Title>
          <Text type="secondary" className={cx('content-map-subtitle')}>
            Быстрый доступ к ключевым разделам и их метрикам
          </Text>
        </div>
      </div>

      <ProjectsSection
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        navProps={navProps}
        loading={loading}
        projectStats={projectStats}
      />

      <ResourcesSection
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        navProps={navProps}
        loading={loading}
        licenseStats={licenseStats}
        proxyStats={proxyStats}
        subscriptionStats={subscriptionStats}
      />

      <FinanceNotesSection
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        navProps={navProps}
        loading={loading}
        financeWindowDays={financeWindowDays}
        financeSummary={financeSummary}
        financeGoldByProject={financeGoldByProject}
        notesStats={notesStats}
        latestNotes={latestNotes}
      />

      <ExpiringSection
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        loading={loading}
        expiringItems={expiringItems}
      />
    </div>
  );
};

export type {
  ContentMapSection,
  ExpiringItem,
  ProjectStats,
} from './content-map-types';
