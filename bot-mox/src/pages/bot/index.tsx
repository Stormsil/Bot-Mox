import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { subscribeBotById } from '../../services/botsApiService';
import { ContentPanel } from '../../components/layout/ContentPanel';
import type { TabType } from '../../components/layout/ContentPanel';
import type { Bot } from '../../types';
import {
  BotPageAlertState,
  BotPageLoading,
  DEFAULT_CONFIGURE_TAB,
  DEFAULT_RESOURCES_TAB,
  MAIN_TABS,
  buildConfigureSections,
  buildResourcesSections,
  getIncompleteTabs,
  getScheduleStats,
  isAccountComplete,
  isCharacterComplete,
  isPersonComplete,
  isScheduleComplete,
  normalizeTabParams,
  renderTabContent,
} from './page';
import type { ConfigureTab, ExtendedBot, MainTab } from './page';
import styles from './BotPage.module.css';
import { uiLogger } from '../../observability/uiLogger'

export const BotPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabsFromQuery = useMemo(() => normalizeTabParams(searchParams), [searchParams]);
  const activeTab = tabsFromQuery.main;
  const configureTab = tabsFromQuery.configure || DEFAULT_CONFIGURE_TAB;
  const resourcesTab = tabsFromQuery.resources || DEFAULT_RESOURCES_TAB;

  const [bot, setBot] = useState<ExtendedBot | null>(null);
  const [loading, setLoading] = useState(() => Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const openConfigureKey = activeTab === 'configure' ? `configure-${configureTab}` : undefined;

  useEffect(() => {
    if (!id) {
      return;
    }

    const unsubscribe = subscribeBotById(
      id,
      (data) => {
        if (data) {
          setBot(data as ExtendedBot);
        } else {
          setBot(null);
        }
        setError(null);
        setLoading(false);
      },
      (loadError) => {
        uiLogger.error('Error loading bot:', loadError);
        setError('Failed to load bot data');
        setLoading(false);
      },
      { intervalMs: 5000 }
    );

    return () => unsubscribe();
  }, [id]);

  const setParamsForTab = (main: MainTab, subtab?: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', main);
    if (subtab) {
      nextParams.set('subtab', subtab);
    } else {
      nextParams.delete('subtab');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleTabChange = (tab: TabType) => {
    if (!MAIN_TABS.includes(tab as MainTab)) {
      return;
    }

    const nextMain = tab as MainTab;
    if (nextMain === 'configure') {
      setParamsForTab(nextMain, configureTab || DEFAULT_CONFIGURE_TAB);
      return;
    }
    if (nextMain === 'resources') {
      setParamsForTab(nextMain, resourcesTab || DEFAULT_RESOURCES_TAB);
      return;
    }

    setParamsForTab(nextMain);
  };

  const handleConfigureTabChange = (tab: ConfigureTab) => {
    setParamsForTab('configure', tab);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (activeTab === 'configure') {
      requestAnimationFrame(() => scrollToSection(`configure-${configureTab}`));
    }
  }, [activeTab, configureTab]);

  useEffect(() => {
    if (activeTab === 'resources') {
      requestAnimationFrame(() => scrollToSection(`resources-${resourcesTab}`));
    }
  }, [activeTab, resourcesTab]);

  const scheduleStats = useMemo(() => getScheduleStats(bot), [bot]);
  const accountComplete = useMemo(() => isAccountComplete(bot), [bot]);
  const personComplete = useMemo(() => isPersonComplete(bot), [bot]);
  const characterComplete = useMemo(() => isCharacterComplete(bot), [bot]);
  const scheduleComplete = useMemo(
    () => isScheduleComplete(scheduleStats.enabledSessions),
    [scheduleStats.enabledSessions]
  );

  if (loading) {
    return <BotPageLoading />;
  }

  if (error) {
    return <BotPageAlertState message="Error" description={error} />;
  }

  if (!id) {
    return <BotPageAlertState message="Bot ID Missing" description={'Route parameter "id" is required.'} />;
  }

  if (!bot) {
    return <BotPageAlertState message="Bot Not Found" description={`Bot with ID "${id}" was not found.`} />;
  }

  const baseBot: Bot = {
    id: bot.id,
    name: bot.character?.name || bot.id,
    project_id: bot.project_id,
    status: bot.status,
    character: bot.character,
    last_seen: bot.last_seen,
  };

  const configureSections = buildConfigureSections({
    bot,
    baseBot,
    personComplete,
    accountComplete,
    characterComplete,
    scheduleComplete,
  });

  const resourcesSections = buildResourcesSections(baseBot);

  const content = renderTabContent({
    activeTab,
    bot,
    baseBot,
    configureSections,
    openConfigureKey,
    onConfigureTabChange: handleConfigureTabChange,
    resourcesSections,
  });

  return (
    <div className={styles.root}>
      <ContentPanel
        type="bot"
        activeTab={activeTab}
        onTabChange={handleTabChange}
        incompleteTabs={getIncompleteTabs(bot)}
      >
        {content}
      </ContentPanel>
    </div>
  );
};
