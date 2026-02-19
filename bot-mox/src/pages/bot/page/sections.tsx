import React from 'react';
import { CheckOutlined, ExclamationOutlined, RightOutlined } from '@ant-design/icons';
import { Collapse } from 'antd';
import {
  BotAccount,
  BotCharacter,
  BotLicense,
  BotLifeStages,
  BotPerson,
  BotProxy,
  BotSchedule,
  BotSubscription,
  BotSummary,
  BotVMInfo,
} from '../../../components/bot';
import type { Bot } from '../../../types';
import styles from '../BotPage.module.css';
import type {
  ConfigureSection,
  ConfigureTab,
  ExtendedBot,
  MainTab,
  ResourceSection,
} from './types';

interface BuildConfigureSectionsOptions {
  bot: ExtendedBot;
  baseBot: Bot;
  personComplete: boolean;
  accountComplete: boolean;
  characterComplete: boolean;
  scheduleComplete: boolean;
}

export const buildConfigureSections = ({
  bot,
  baseBot,
  personComplete,
  accountComplete,
  characterComplete,
  scheduleComplete,
}: BuildConfigureSectionsOptions): ConfigureSection[] => [
  {
    key: 'person',
    label: 'Person',
    description: 'Fill in personal profile data',
    complete: personComplete,
    content: <BotPerson bot={bot} />,
  },
  {
    key: 'account',
    label: 'Account',
    description: 'Set credentials and registration data',
    complete: accountComplete,
    content: <BotAccount bot={bot} />,
  },
  {
    key: 'character',
    label: 'Character',
    description: 'Configure in-game character details',
    complete: characterComplete,
    content: <BotCharacter bot={baseBot} mode="edit" />,
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Define when the bot should run',
    complete: scheduleComplete,
    content: <BotSchedule botId={baseBot.id} />,
  },
];

export const buildResourcesSections = (baseBot: Bot): ResourceSection[] => [
  { key: 'license', content: <BotLicense bot={baseBot} /> },
  { key: 'proxy', content: <BotProxy bot={baseBot} /> },
  { key: 'subscription', content: <BotSubscription bot={baseBot} /> },
];

interface RenderTabContentOptions {
  activeTab: MainTab;
  bot: ExtendedBot;
  baseBot: Bot;
  configureSections: ConfigureSection[];
  openConfigureKey?: string;
  onConfigureTabChange: (tab: ConfigureTab) => void;
  resourcesSections: ResourceSection[];
}

export const renderTabContent = ({
  activeTab,
  bot,
  baseBot,
  configureSections,
  openConfigureKey,
  onConfigureTabChange,
  resourcesSections,
}: RenderTabContentOptions) => {
  if (activeTab === 'summary') {
    return <BotSummary bot={bot} />;
  }

  if (activeTab === 'monitoring') {
    return <BotLifeStages bot={baseBot} botId={bot.id} />;
  }

  if (activeTab === 'configure') {
    return (
      <div className={styles.configure}>
        <Collapse
          className={styles.configureCollapse}
          accordion
          activeKey={openConfigureKey}
          onChange={(key) => {
            const nextKey = Array.isArray(key) ? key[0] : key;
            if (nextKey) {
              const tabKey = nextKey.replace('configure-', '') as ConfigureTab;
              onConfigureTabChange(tabKey);
            }
          }}
          items={configureSections.map((section, index) => {
            const key = `configure-${section.key}`;
            const isOpen = openConfigureKey === key;
            const isLast = index === configureSections.length - 1;

            return {
              key,
              showArrow: false,
              className: [
                styles.configureItem,
                isLast ? styles.configureItemLast : '',
              ].filter(Boolean).join(' '),
              label: (
                <div className={styles.configureHeader}>
                  <div className={styles.configurePanelHeader}>
                    <div className={styles.configurePanelTitle}>
                      {section.complete ? (
                        <span className={`${styles.configurePanelIcon} ${styles.configurePanelIconComplete}`}>
                          <CheckOutlined />
                        </span>
                      ) : (
                        <span className={`${styles.configurePanelIcon} ${styles.configurePanelIconWarning}`}>
                          <ExclamationOutlined />
                        </span>
                      )}
                      <span className={styles.configurePanelIndex}>{index + 1}.</span>
                      <span className={styles.configurePanelLabel}>{section.label}</span>
                    </div>
                    <div className={styles.configurePanelDesc}>{section.description}</div>
                  </div>
                  <RightOutlined
                    className={[
                      styles.configureHeaderArrow,
                      isOpen ? styles.configureHeaderArrowOpen : '',
                    ].filter(Boolean).join(' ')}
                    aria-hidden
                  />
                </div>
              ),
              children: (
                <div className={styles.configureBody}>
                  <section id={key} className={styles.section}>
                    {section.content}
                  </section>
                </div>
              ),
            };
          })}
        />
      </div>
    );
  }

  if (activeTab === 'resources') {
    return (
      <div className={styles.subtabsContent}>
        {resourcesSections.map((section) => (
          <section key={section.key} id={`resources-${section.key}`} className={styles.section}>
            {section.content}
          </section>
        ))}
      </div>
    );
  }

  if (activeTab === 'vmInfo') {
    return <BotVMInfo bot={bot} />;
  }

  return <BotSummary bot={bot} />;
};
