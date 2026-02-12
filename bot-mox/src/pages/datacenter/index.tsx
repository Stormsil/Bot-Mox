import React, { useEffect, useMemo, useState } from 'react';
import { Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ContentPanel } from '../../components/layout/ContentPanel';
import type { BotLicense, Proxy, Subscription } from '../../types';
import { useFinance } from '../../hooks/useFinance';
import { calculateFinanceSummary } from '../../services/financeService';
import { getSubscriptionSettings } from '../../services/settingsService';
import { subscribeToNotesIndex } from '../../services/notesService';
import type { NoteIndex } from '../../services/notesService';
import { subscribeBotsMap } from '../../services/botsApiService';
import type { BotRecord } from '../../services/botsApiService';
import { subscribeResources } from '../../services/resourcesApiService';
import {
  type ContentMapSection,
  type ExpiringItem,
  DatacenterContentMap,
} from './content-map';
import {
  buildProjectStats,
  CONTENT_MAP_COLLAPSE_KEY,
  DEFAULT_COLLAPSED_SECTIONS,
  FINANCE_WINDOW_DAYS,
  MS_PER_DAY,
} from './page-helpers';
import './DatacenterPage.css';

export const DatacenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const [bots, setBots] = useState<Record<string, BotRecord>>({});
  const [botsLoading, setBotsLoading] = useState(true);

  const [licenses, setLicenses] = useState<BotLicense[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(true);

  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(true);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);

  const [notesIndex, setNotesIndex] = useState<NoteIndex[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

  const [warningDays, setWarningDays] = useState(7);
  const [collapsedSections, setCollapsedSections] = useState<Record<ContentMapSection, boolean>>(
    () => {
      const saved = localStorage.getItem(CONTENT_MAP_COLLAPSE_KEY);
      if (saved) {
        try {
          return { ...DEFAULT_COLLAPSED_SECTIONS, ...JSON.parse(saved) };
        } catch (error) {
          console.warn('Failed to parse content map collapse state:', error);
        }
      }
      return DEFAULT_COLLAPSED_SECTIONS;
    }
  );

  const { operations, loading: financeLoading } = useFinance({ days: 365 });

  useEffect(() => {
    return subscribeBotsMap(
      (data) => {
        setBots(data || {});
        setBotsLoading(false);
      },
      (error) => {
        console.error('Error loading bots:', error);
        setBotsLoading(false);
      },
      { intervalMs: 5000 }
    );
  }, []);

  useEffect(() => {
    return subscribeResources<BotLicense>(
      'licenses',
      (list) => {
        setLicenses(list || []);
        setLicensesLoading(false);
      },
      (error) => {
        console.error('Error loading licenses:', error);
        setLicensesLoading(false);
      },
      { intervalMs: 7000 }
    );
  }, []);

  useEffect(() => {
    return subscribeResources<Proxy>(
      'proxies',
      (list) => {
        setProxies(list || []);
        setProxiesLoading(false);
      },
      (error) => {
        console.error('Error loading proxies:', error);
        setProxiesLoading(false);
      },
      { intervalMs: 7000 }
    );
  }, []);

  useEffect(() => {
    return subscribeResources<Subscription>(
      'subscriptions',
      (list) => {
        setSubscriptions(list || []);
        setSubscriptionsLoading(false);
      },
      (error) => {
        console.error('Error loading subscriptions:', error);
        setSubscriptionsLoading(false);
      },
      { intervalMs: 7000 }
    );
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotesIndex((notes) => {
      setNotesIndex(notes || []);
      setNotesLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    getSubscriptionSettings()
      .then((settings) => setWarningDays(settings.warning_days || 7))
      .catch(() => setWarningDays(7));
  }, []);

  useEffect(() => {
    localStorage.setItem(CONTENT_MAP_COLLAPSE_KEY, JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const toggleSection = (section: ContentMapSection) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const botsList = useMemo(() => Object.values(bots), [bots]);

  const projectStats = useMemo(() => {
    const tbcBots = botsList.filter((bot) => bot.project_id === 'wow_tbc');
    const midnightBots = botsList.filter((bot) => bot.project_id === 'wow_midnight');

    return {
      all: buildProjectStats(botsList, currentTime),
      wow_tbc: buildProjectStats(tbcBots, currentTime),
      wow_midnight: buildProjectStats(midnightBots, currentTime),
    };
  }, [botsList, currentTime]);

  const financeSummary = useMemo(() => {
    const start = currentTime - FINANCE_WINDOW_DAYS * MS_PER_DAY;
    const windowOps = operations.filter((op) => op.date >= start);
    return calculateFinanceSummary(windowOps);
  }, [operations, currentTime]);

  const financeGoldByProject = useMemo(() => {
    const start = currentTime - FINANCE_WINDOW_DAYS * MS_PER_DAY;

    const seed = {
      wow_tbc: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
      wow_midnight: { totalGold: 0, priceSum: 0, priceCount: 0, avgPrice: 0 },
    };

    operations.forEach((op) => {
      if (op.date < start) return;
      if (op.type !== 'income' || op.category !== 'sale') return;
      if (!op.project_id) return;
      if (!(op.project_id in seed)) return;

      const projectKey = op.project_id as 'wow_tbc' | 'wow_midnight';
      seed[projectKey].totalGold += op.gold_amount || 0;
      if (typeof op.gold_price_at_time === 'number' && op.gold_price_at_time > 0) {
        seed[projectKey].priceSum += op.gold_price_at_time;
        seed[projectKey].priceCount += 1;
      }
    });

    (Object.keys(seed) as Array<'wow_tbc' | 'wow_midnight'>).forEach((key) => {
      const entry = seed[key];
      entry.avgPrice = entry.priceCount > 0 ? entry.priceSum / entry.priceCount : 0;
    });

    return seed;
  }, [operations, currentTime]);

  const licenseStats = useMemo(() => {
    const expiringSoon = licenses.filter((license) => {
      const daysRemaining = Math.ceil((license.expires_at - currentTime) / MS_PER_DAY);
      return daysRemaining <= warningDays && daysRemaining > 0;
    }).length;

    const expired = licenses.filter((license) => license.expires_at <= currentTime).length;
    const active = licenses.filter(
      (license) => license.status === 'active' && license.expires_at > currentTime
    ).length;
    const unassigned = licenses.filter((license) => !license.bot_ids || license.bot_ids.length === 0)
      .length;

    return {
      total: licenses.length,
      active,
      expiringSoon,
      expired,
      unassigned,
    };
  }, [licenses, warningDays, currentTime]);

  const proxyStats = useMemo(() => {
    const expiringSoon = proxies.filter((proxy) => {
      if (proxy.status === 'banned') return false;
      const daysRemaining = Math.ceil((proxy.expires_at - currentTime) / MS_PER_DAY);
      return daysRemaining <= warningDays && daysRemaining > 0;
    }).length;

    const expired = proxies.filter(
      (proxy) => proxy.expires_at <= currentTime || proxy.status === 'expired'
    ).length;
    const active = proxies.filter(
      (proxy) => proxy.status === 'active' && proxy.expires_at > currentTime
    ).length;
    const unassigned = proxies.filter((proxy) => !proxy.bot_id).length;

    return {
      total: proxies.length,
      active,
      expiringSoon,
      expired,
      unassigned,
    };
  }, [proxies, warningDays, currentTime]);

  const subscriptionStats = useMemo(() => {
    const expiringSoon = subscriptions.filter((sub) => {
      const daysRemaining = Math.ceil((sub.expires_at - currentTime) / MS_PER_DAY);
      return daysRemaining <= warningDays && daysRemaining > 0;
    }).length;

    const expired = subscriptions.filter((sub) => sub.expires_at <= currentTime).length;
    const active = subscriptions.filter((sub) => sub.expires_at > currentTime).length;

    return {
      total: subscriptions.length,
      active,
      expired,
      expiringSoon,
    };
  }, [subscriptions, warningDays, currentTime]);

  const notesStats = useMemo(() => {
    const total = notesIndex.length;
    const pinned = notesIndex.filter((note) => note.is_pinned).length;
    return { total, pinned };
  }, [notesIndex]);

  const latestNotes = useMemo(() => notesIndex.slice(0, 5), [notesIndex]);

  const expiringItems = useMemo(() => {
    const items: ExpiringItem[] = [];

    licenses.forEach((license) => {
      const daysRemaining = Math.ceil((license.expires_at - currentTime) / MS_PER_DAY);
      if (daysRemaining <= warningDays && daysRemaining > 0) {
        const botName = license.bot_ids?.length
          ? bots[license.bot_ids[0]]?.character?.name
          : undefined;
        items.push({
          id: license.id,
          type: 'license',
          name: `License (${license.type})`,
          botName,
          daysRemaining,
          expiresAt: license.expires_at,
        });
      }
    });

    proxies.forEach((proxy) => {
      if (proxy.status === 'banned') return;
      const daysRemaining = Math.ceil((proxy.expires_at - currentTime) / MS_PER_DAY);
      if (daysRemaining <= warningDays && daysRemaining > 0) {
        const botName = proxy.bot_id ? bots[proxy.bot_id]?.character?.name : undefined;
        items.push({
          id: proxy.id,
          type: 'proxy',
          name: `Proxy (${proxy.ip}:${proxy.port})`,
          botName,
          daysRemaining,
          expiresAt: proxy.expires_at,
        });
      }
    });

    subscriptions.forEach((sub) => {
      const daysRemaining = Math.ceil((sub.expires_at - currentTime) / MS_PER_DAY);
      if (daysRemaining <= warningDays && daysRemaining > 0) {
        const botName = sub.bot_id ? bots[sub.bot_id]?.character?.name : undefined;
        items.push({
          id: sub.id,
          type: 'subscription',
          name: `Subscription (${sub.type})`,
          botName,
          daysRemaining,
          expiresAt: sub.expires_at,
        });
      }
    });

    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [licenses, proxies, subscriptions, bots, warningDays, currentTime]);

  const initialLoading =
    botsLoading
    && licensesLoading
    && proxiesLoading
    && subscriptionsLoading
    && financeLoading
    && notesLoading;

  const navProps = (path: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => navigate(path),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigate(path);
      }
    },
  });

  if (initialLoading) {
    return (
      <div className="datacenter-page">
        <ContentPanel type="datacenter">
          <div className="loading-container">
            <Spin size="large" />
          </div>
        </ContentPanel>
      </div>
    );
  }

  return (
    <div className="datacenter-page">
      <ContentPanel type="datacenter">
        <DatacenterContentMap
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          navProps={navProps}
          loading={{
            bots: botsLoading,
            licenses: licensesLoading,
            proxies: proxiesLoading,
            subscriptions: subscriptionsLoading,
            finance: financeLoading,
            notes: notesLoading,
          }}
          projectStats={projectStats}
          licenseStats={licenseStats}
          proxyStats={proxyStats}
          subscriptionStats={subscriptionStats}
          financeWindowDays={FINANCE_WINDOW_DAYS}
          financeSummary={financeSummary}
          financeGoldByProject={financeGoldByProject}
          notesStats={notesStats}
          latestNotes={latestNotes}
          expiringItems={expiringItems}
        />
      </ContentPanel>
    </div>
  );
};
