import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Spin } from 'antd';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../utils/firebase';
import { ContentPanel } from '../../components/layout/ContentPanel';
import type { TabType } from '../../components/layout/ContentPanel';
import {
  BotSummary,
  BotCharacter,
  BotLogs,
  BotSchedule,
  BotAccount,
  BotPerson,
  BotLicense,
  BotProxy,
  BotSubscription,
  BotLifeStages,
} from '../../components/bot';
import type { Bot } from '../../types';
import './BotPage.css';

// Extended Bot type with all Firebase fields
interface ExtendedBot extends Bot {
  vm?: {
    name: string;
    ip: string;
    created_at: string;
  };
  account?: {
    email: string;
    password: string;
    mail_provider: string;
    bnet_created_at: number;
    mail_created_at: number;
  };
  person?: {
    first_name?: string;
    last_name?: string;
    birth_date?: string;
    country?: string;
    city?: string;
    address?: string;
    zip?: string;
  };
  proxy?: {
    full_string: string;
    type: string;
    ip: string;
    port: number;
    login: string;
    password: string;
    provider: string;
    country: string;
    fraud_score: number;
    VPN: boolean;
    Proxy: boolean;
    detect_country: boolean;
    created_at: number;
    expires_at: number;
  };
  leveling?: {
    current_level: number;
    target_level: number;
    xp_current: number;
    xp_required: number;
    xp_per_hour: number;
    estimated_time_to_level: number;
    location: string;
    sub_location: string;
    started_at: number;
    finished_at: number;
  };
  professions?: Record<string, {
    name: string;
    skill_points: number;
    max_skill_points: number;
    started_at: number;
    finished_at: number;
  }>;
  schedule?: Record<string, Array<{
    start: string;
    end: string;
    enabled: boolean;
    profile: string;
  }>>;
  farm?: {
    total_gold: number;
    gold_per_hour: number;
    session_start: number;
    location: string;
    profile: string;
    all_farmed_gold: number;
  };
  finance?: {
    total_farmed_usd: number;
    total_expenses_usd: number;
    roi_percent: number;
  };
  monitor?: {
    screenshot_request: boolean;
    screenshot_url: string | null;
    screenshot_timestamp: number | null;
    status: string;
  };
  updated_at?: number;
  created_at?: number;
}

export const BotPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [bot, setBot] = useState<ExtendedBot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка данных бота из Firebase с realtime обновлениями
  useEffect(() => {
    if (!id) {
      setError('Bot ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const botRef = ref(database, `bots/${id}`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      console.log('Firebase data received:', data);
      console.log('Firebase person data:', data?.person);
      if (data) {
        const botData = {
          id,
          ...data,
        } as ExtendedBot;
        console.log('Bot data with person:', botData.person);
        setBot(botData);
      } else {
        setBot(null);
      }
      setLoading(false);
    };

    const handleError = (err: Error) => {
      console.error('Error loading bot:', err);
      setError('Failed to load bot data');
      setLoading(false);
    };

    onValue(botRef, handleValue, handleError);

    return () => {
      off(botRef, 'value', handleValue);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="bot-page">
        <div className="bot-page-loading">
          <Spin size="large" />
          <p>Loading bot data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bot-page">
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="bot-page">
        <Alert
          message="Bot Not Found"
          description={`Bot with ID "${id}" was not found.`}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const renderTabContent = () => {
    // Pass full ExtendedBot to components that need extra fields
    if (activeTab === 'person') {
      return <BotPerson bot={bot} />;
    }

    if (activeTab === 'account') {
      return <BotAccount bot={bot} />;
    }

    // Convert ExtendedBot to Bot for components that expect the base type
    const baseBot: Bot = {
      id: bot.id,
      name: bot.character?.name || bot.id,
      project_id: bot.project_id,
      status: bot.status,
      character: bot.character,
      last_seen: bot.last_seen,
    };

    switch (activeTab) {
      case 'summary':
        return <BotSummary bot={baseBot} />;
      case 'schedule':
        return <BotSchedule botId={baseBot.id} />;
      case 'lifeStages':
        return <BotLifeStages bot={baseBot} botId={bot.id} />;
      case 'character':
        return <BotCharacter bot={baseBot} />;
      case 'logs':
        return <BotLogs bot={baseBot} />;
      case 'license':
        return <BotLicense bot={baseBot} />;
      case 'proxy':
        return <BotProxy bot={baseBot} />;
      case 'subscription':
        return <BotSubscription bot={baseBot} />;
      default:
        return <BotSummary bot={baseBot} />;
    }
  };

  // Check if person data is incomplete
  const isPersonDataIncomplete = (): boolean => {
    if (!bot?.person) return true;
    return !!(
      !bot.person.first_name?.trim() ||
      !bot.person.last_name?.trim() ||
      !bot.person.birth_date?.trim() ||
      !bot.person.country?.trim() ||
      !bot.person.city?.trim() ||
      !bot.person.address?.trim() ||
      !bot.person.zip?.trim()
    );
  };

  // Check if account data is incomplete
  const isAccountDataIncomplete = (): boolean => {
    if (!bot?.account) return true;
    return !!(
      !bot.account.email?.trim() ||
      !bot.account.password?.trim()
    );
  };

  // Get list of incomplete tabs
  const getIncompleteTabs = (): TabType[] => {
    const incomplete: TabType[] = [];
    if (isPersonDataIncomplete()) {
      incomplete.push('person');
    }
    if (isAccountDataIncomplete()) {
      incomplete.push('account');
    }
    return incomplete;
  };

  return (
    <div className="bot-page">
      <ContentPanel
        type="bot"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        incompleteTabs={getIncompleteTabs()}
      >
        {renderTabContent()}
      </ContentPanel>
    </div>
  );
};
