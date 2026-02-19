import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { TabType } from '../../components/layout/ContentPanel';
import { ContentPanel } from '../../components/layout/ContentPanel';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import { uiLogger } from '../../observability/uiLogger';
import type { Bot } from '../../types';
import styles from './BotPage.module.css';
import type { ConfigureTab, ExtendedBot, MainTab } from './page';
import {
  BotPageAlertState,
  BotPageLoading,
  buildConfigureSections,
  buildResourcesSections,
  DEFAULT_CONFIGURE_TAB,
  DEFAULT_RESOURCES_TAB,
  getIncompleteTabs,
  getScheduleStats,
  isAccountComplete,
  isCharacterComplete,
  isPersonComplete,
  isScheduleComplete,
  MAIN_TABS,
  normalizeTabParams,
  renderTabContent,
} from './page';

export const BotPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabsFromQuery = useMemo(() => normalizeTabParams(searchParams), [searchParams]);
  const activeTab = tabsFromQuery.main;
  const configureTab = tabsFromQuery.configure || DEFAULT_CONFIGURE_TAB;
  const resourcesTab = tabsFromQuery.resources || DEFAULT_RESOURCES_TAB;

  const botQuery = useBotByIdQuery(id);
  const bot = (botQuery.data || null) as ExtendedBot | null;
  const openConfigureKey = activeTab === 'configure' ? `configure-${configureTab}` : undefined;

  useEffect(() => {
    if (!botQuery.error) {
      return;
    }
    uiLogger.error('Error loading bot:', botQuery.error);
  }, [botQuery.error]);

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

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'configure') {
      requestAnimationFrame(() => scrollToSection(`configure-${configureTab}`));
    }
  }, [activeTab, configureTab, scrollToSection]);

  useEffect(() => {
    if (activeTab === 'resources') {
      requestAnimationFrame(() => scrollToSection(`resources-${resourcesTab}`));
    }
  }, [activeTab, resourcesTab, scrollToSection]);

  const scheduleStats = useMemo(() => getScheduleStats(bot), [bot]);
  const accountComplete = useMemo(() => isAccountComplete(bot), [bot]);
  const personComplete = useMemo(() => isPersonComplete(bot), [bot]);
  const characterComplete = useMemo(() => isCharacterComplete(bot), [bot]);
  const scheduleComplete = useMemo(
    () => isScheduleComplete(scheduleStats.enabledSessions),
    [scheduleStats.enabledSessions],
  );

  if (botQuery.isLoading) {
    return <BotPageLoading />;
  }

  if (botQuery.error) {
    return <BotPageAlertState message="Error" description="Failed to load bot data" />;
  }

  if (!id) {
    return (
      <BotPageAlertState
        message="Bot ID Missing"
        description={'Route parameter "id" is required.'}
      />
    );
  }

  if (!bot) {
    return (
      <BotPageAlertState
        message="Bot Not Found"
        description={`Bot with ID "${id}" was not found.`}
      />
    );
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
