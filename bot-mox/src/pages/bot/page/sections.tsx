import React from 'react';
import { CheckOutlined, ExclamationOutlined } from '@ant-design/icons';
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
import type { ConfigureSection, ConfigureTab, ExtendedBot, MainTab, ResourceSection } from './types';

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
      <div className="bot-configure">
        <Collapse
          className="bot-configure-collapse"
          accordion
          activeKey={openConfigureKey}
          onChange={(key) => {
            const nextKey = Array.isArray(key) ? key[0] : key;
            if (nextKey) {
              const tabKey = nextKey.replace('configure-', '') as ConfigureTab;
              onConfigureTabChange(tabKey);
            }
          }}
          items={configureSections.map((section, index) => ({
            key: `configure-${section.key}`,
            label: (
              <div className="bot-configure-panel-header">
                <div className="bot-configure-panel-title">
                  {section.complete ? (
                    <span className="bot-configure-panel-icon complete">
                      <CheckOutlined />
                    </span>
                  ) : (
                    <span className="bot-configure-panel-icon warning">
                      <ExclamationOutlined />
                    </span>
                  )}
                  <span className="bot-configure-panel-index">{index + 1}.</span>
                  <span className="bot-configure-panel-label">{section.label}</span>
                </div>
                <div className="bot-configure-panel-desc">{section.description}</div>
              </div>
            ),
            children: (
              <section id={`configure-${section.key}`} className="bot-section">
                {section.content}
              </section>
            ),
          }))}
        />
      </div>
    );
  }

  if (activeTab === 'resources') {
    return (
      <div className="bot-subtabs-content">
        {resourcesSections.map((section) => (
          <section key={section.key} id={`resources-${section.key}`} className="bot-section">
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
