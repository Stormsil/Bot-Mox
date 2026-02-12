import React from 'react';
import { Button, Card, Tag, Typography } from 'antd';
import {
  DollarOutlined,
  DownOutlined,
  FileTextOutlined,
  RightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type {
  ContentMapSection,
  DatacenterLoadingState,
  ExpiringItem,
  NavPropsFactory,
} from './content-map-types';

const { Text } = Typography;

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatSignedCurrency = (value: number) =>
  `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;

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

export function FinanceNotesSection({
  collapsedSections,
  toggleSection,
  navProps,
  loading,
  financeWindowDays,
  financeSummary,
  financeGoldByProject,
  notesStats,
  latestNotes,
}: {
  collapsedSections: Record<ContentMapSection, boolean>;
  toggleSection: (section: ContentMapSection) => void;
  navProps: NavPropsFactory;
  loading: DatacenterLoadingState;
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
  notesStats: { total: number; pinned: number };
  latestNotes: Array<{ id: string; title?: string }>;
}) {
  return (
    <div className="content-map-section">
      <div className="content-map-section-head">
        <div className="content-map-section-title">Finance & Notes</div>
        <SectionToggle
          section="finance_notes"
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
        />
      </div>
      {!collapsedSections.finance_notes && (
        <div className="content-map-grid content-map-grid--primary">
          <Card className="map-card map-card--clickable" hoverable loading={loading.finance} {...navProps('/finance')}>
            <div className="map-card-head">
              <div className="map-card-title">
                <DollarOutlined /> Finance
              </div>
              <Tag className="map-card-tag">{financeWindowDays} Days</Tag>
            </div>
            <div className="map-kpi-grid">
              <div className="map-kpi">
                <span className="map-kpi-label">Income</span>
                <span className="map-kpi-value">{formatCurrency(financeSummary.totalIncome)}</span>
              </div>
              <div className="map-kpi">
                <span className="map-kpi-label">Expenses</span>
                <span className="map-kpi-value">{formatCurrency(financeSummary.totalExpenses)}</span>
              </div>
              <div className="map-kpi">
                <span className="map-kpi-label">Net</span>
                <span className="map-kpi-value">{formatSignedCurrency(financeSummary.netProfit)}</span>
              </div>
              <div className="map-kpi map-kpi--stack">
                <span className="map-kpi-label">Sold Gold</span>
                <div className="map-kpi-lines">
                  <div className="map-kpi-line">
                    <span className="map-kpi-line-label">WoW TBC</span>
                    <span className="map-kpi-line-value">{financeGoldByProject.wow_tbc.totalGold.toLocaleString()} g</span>
                    <span className="map-kpi-line-sub">${financeGoldByProject.wow_tbc.avgPrice.toFixed(4)}/1000g</span>
                  </div>
                  <div className="map-kpi-line">
                    <span className="map-kpi-line-label">WoW Midnight</span>
                    <span className="map-kpi-line-value">{financeGoldByProject.wow_midnight.totalGold.toLocaleString()} g</span>
                    <span className="map-kpi-line-sub">${financeGoldByProject.wow_midnight.avgPrice.toFixed(4)}/1000g</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="map-card-footer">
              <span>Open finance</span>
              <RightOutlined />
            </div>
          </Card>

          <Card className="map-card map-card--clickable" hoverable loading={loading.notes} {...navProps('/notes')}>
            <div className="map-card-head">
              <div className="map-card-title">
                <FileTextOutlined /> Notes
              </div>
              <Tag className="map-card-tag">{notesStats.total} total</Tag>
            </div>
            <div className="map-stats-row">
              <div className="map-stat-chip">
                <span className="map-stat-value">{notesStats.pinned}</span>
                <span className="map-stat-label">Pinned</span>
              </div>
              <div className="map-stat-chip">
                <span className="map-stat-value">{notesStats.total - notesStats.pinned}</span>
                <span className="map-stat-label">Regular</span>
              </div>
            </div>
            <div className="map-card-meta map-card-meta--stack">
              {latestNotes.length > 0 ? (
                <div className="map-notes-list">
                  {latestNotes.map((note) => (
                    <div key={note.id} className="map-note-item">
                      <span className="map-note-title">{note.title || 'Untitled'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">No notes yet</Text>
              )}
            </div>
            <div className="map-card-footer">
              <span>Open notes</span>
              <RightOutlined />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function ExpiringSection({
  collapsedSections,
  toggleSection,
  loading,
  expiringItems,
}: {
  collapsedSections: Record<ContentMapSection, boolean>;
  toggleSection: (section: ContentMapSection) => void;
  loading: DatacenterLoadingState;
  expiringItems: ExpiringItem[];
}) {
  return (
    <div className="content-map-section">
      <div className="content-map-section-head">
        <div className="content-map-section-title">Expiring Soon</div>
        <SectionToggle
          section="expiring"
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
        />
      </div>
      {!collapsedSections.expiring && (
        <Card className="map-card" loading={loading.licenses || loading.proxies || loading.subscriptions}>
          <div className="map-card-head">
            <div className="map-card-title">
              <WarningOutlined /> Alerts
            </div>
            <Tag className="map-card-tag">{expiringItems.length} items</Tag>
          </div>

          {expiringItems.length > 0 ? (
            <div className="expiring-list">
              {expiringItems.slice(0, 4).map((item) => (
                <div key={item.id} className="expiring-row">
                  <Tag className={`expiring-tag expiring-tag--${item.type}`}>
                    {item.type}
                  </Tag>
                  <div className="expiring-main">
                    <span className="expiring-name">{item.name}</span>
                    {item.botName && <span className="expiring-bot">{item.botName}</span>}
                  </div>
                  <div className="expiring-meta">
                    <span className={`expiring-days ${item.daysRemaining <= 3 ? 'danger' : 'warning'}`}>
                      {item.daysRemaining}d
                    </span>
                    <span className="expiring-date">{dayjs(item.expiresAt).format('DD.MM.YYYY')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="expiring-empty">
              <Text type="secondary">No items expiring soon</Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
