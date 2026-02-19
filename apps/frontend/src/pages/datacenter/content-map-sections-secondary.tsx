import {
  DollarOutlined,
  FileTextOutlined,
  RightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Card, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { SectionToggle } from './content-map-toggle';
import type {
  ContentMapSection,
  DatacenterLoadingState,
  ExpiringItem,
  NavPropsFactory,
} from './content-map-types';
import { cx, mapCardStyles } from './datacenterUi';

const { Text } = Typography;

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatSignedCurrency = (value: number) =>
  `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;

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
    <div className={cx('content-map-section')}>
      <div className={cx('content-map-section-head')}>
        <div className={cx('content-map-section-title')}>Finance & Notes</div>
        <SectionToggle
          section="finance_notes"
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
        />
      </div>
      {!collapsedSections.finance_notes && (
        <div className={cx('content-map-grid content-map-grid--primary')}>
          <Card
            className={cx('map-card map-card--clickable')}
            hoverable
            loading={loading.finance}
            styles={mapCardStyles}
            {...navProps('/finance')}
          >
            <div className={cx('map-card-head')}>
              <div className={cx('map-card-title')}>
                <DollarOutlined /> Finance
              </div>
              <Tag className={cx('map-card-tag')}>{financeWindowDays} Days</Tag>
            </div>
            <div className={cx('map-kpi-grid')}>
              <div className={cx('map-kpi')}>
                <span className={cx('map-kpi-label')}>Income</span>
                <span className={cx('map-kpi-value')}>
                  {formatCurrency(financeSummary.totalIncome)}
                </span>
              </div>
              <div className={cx('map-kpi')}>
                <span className={cx('map-kpi-label')}>Expenses</span>
                <span className={cx('map-kpi-value')}>
                  {formatCurrency(financeSummary.totalExpenses)}
                </span>
              </div>
              <div className={cx('map-kpi')}>
                <span className={cx('map-kpi-label')}>Net</span>
                <span className={cx('map-kpi-value')}>
                  {formatSignedCurrency(financeSummary.netProfit)}
                </span>
              </div>
              <div className={cx('map-kpi map-kpi--stack')}>
                <span className={cx('map-kpi-label')}>Sold Gold</span>
                <div className={cx('map-kpi-lines')}>
                  <div className={cx('map-kpi-line')}>
                    <span className={cx('map-kpi-line-label')}>WoW TBC</span>
                    <span className={cx('map-kpi-line-value')}>
                      {financeGoldByProject.wow_tbc.totalGold.toLocaleString()} g
                    </span>
                    <span className={cx('map-kpi-line-sub')}>
                      ${financeGoldByProject.wow_tbc.avgPrice.toFixed(4)}/1000g
                    </span>
                  </div>
                  <div className={cx('map-kpi-line')}>
                    <span className={cx('map-kpi-line-label')}>WoW Midnight</span>
                    <span className={cx('map-kpi-line-value')}>
                      {financeGoldByProject.wow_midnight.totalGold.toLocaleString()} g
                    </span>
                    <span className={cx('map-kpi-line-sub')}>
                      ${financeGoldByProject.wow_midnight.avgPrice.toFixed(4)}/1000g
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={cx('map-card-footer')}>
              <span>Open finance</span>
              <RightOutlined />
            </div>
          </Card>

          <Card
            className={cx('map-card map-card--clickable')}
            hoverable
            loading={loading.notes}
            styles={mapCardStyles}
            {...navProps('/notes')}
          >
            <div className={cx('map-card-head')}>
              <div className={cx('map-card-title')}>
                <FileTextOutlined /> Notes
              </div>
              <Tag className={cx('map-card-tag')}>{notesStats.total} total</Tag>
            </div>
            <div className={cx('map-stats-row')}>
              <div className={cx('map-stat-chip')}>
                <span className={cx('map-stat-value')}>{notesStats.pinned}</span>
                <span className={cx('map-stat-label')}>Pinned</span>
              </div>
              <div className={cx('map-stat-chip')}>
                <span className={cx('map-stat-value')}>{notesStats.total - notesStats.pinned}</span>
                <span className={cx('map-stat-label')}>Regular</span>
              </div>
            </div>
            <div className={cx('map-card-meta map-card-meta--stack')}>
              {latestNotes.length > 0 ? (
                <div className={cx('map-notes-list')}>
                  {latestNotes.map((note) => (
                    <div key={note.id} className={cx('map-note-item')}>
                      <span className={cx('map-note-title')}>{note.title || 'Untitled'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">No notes yet</Text>
              )}
            </div>
            <div className={cx('map-card-footer')}>
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
    <div className={cx('content-map-section')}>
      <div className={cx('content-map-section-head')}>
        <div className={cx('content-map-section-title')}>Expiring Soon</div>
        <SectionToggle
          section="expiring"
          collapsedSections={collapsedSections}
          onToggle={toggleSection}
        />
      </div>
      {!collapsedSections.expiring && (
        <Card
          className={cx('map-card')}
          loading={loading.licenses || loading.proxies || loading.subscriptions}
          styles={mapCardStyles}
        >
          <div className={cx('map-card-head')}>
            <div className={cx('map-card-title')}>
              <WarningOutlined /> Alerts
            </div>
            <Tag className={cx('map-card-tag')}>{expiringItems.length} items</Tag>
          </div>

          {expiringItems.length > 0 ? (
            <div className={cx('expiring-list')}>
              {expiringItems.slice(0, 4).map((item) => (
                <div key={item.id} className={cx('expiring-row')}>
                  <Tag className={cx(`expiring-tag expiring-tag--${item.type}`)}>{item.type}</Tag>
                  <div className={cx('expiring-main')}>
                    <span className={cx('expiring-name')}>{item.name}</span>
                    {item.botName && <span className={cx('expiring-bot')}>{item.botName}</span>}
                  </div>
                  <div className={cx('expiring-meta')}>
                    <span
                      className={cx(
                        `expiring-days ${item.daysRemaining <= 3 ? 'expiring-days--danger' : 'expiring-days--warning'}`,
                      )}
                    >
                      {item.daysRemaining}d
                    </span>
                    <span className={cx('expiring-date')}>
                      {dayjs(item.expiresAt).format('DD.MM.YYYY')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cx('expiring-empty')}>
              <Text type="secondary">No items expiring soon</Text>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
