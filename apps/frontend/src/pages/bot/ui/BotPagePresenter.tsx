import type React from 'react';
import type { TabType } from '../../../components/layout/ContentPanel';
import { ContentPanel } from '../../../components/layout/ContentPanel';
import styles from '../BotPage.module.css';
import type { MainTab } from '../page';
import { BotPageAlertState, BotPageLoading } from '../page';

interface BotPagePresenterProps {
  state: {
    status: 'loading' | 'error' | 'missing-id' | 'not-found' | 'ready';
    message?: string;
    description?: string;
  };
  panel: {
    activeTab: MainTab;
    onTabChange: (tab: TabType) => void;
    incompleteTabs: React.ComponentProps<typeof ContentPanel>['incompleteTabs'];
    content: React.ReactNode;
  } | null;
}

export const BotPagePresenter: React.FC<BotPagePresenterProps> = ({ state, panel }) => {
  if (state.status === 'loading') {
    return <BotPageLoading />;
  }

  if (state.status !== 'ready' || !panel) {
    return (
      <BotPageAlertState
        message={state.message || 'Error'}
        description={state.description || 'Unexpected state'}
      />
    );
  }

  return (
    <div className={styles.root}>
      <ContentPanel
        type="bot"
        activeTab={panel.activeTab}
        onTabChange={panel.onTabChange}
        incompleteTabs={panel.incompleteTabs}
      >
        {panel.content}
      </ContentPanel>
    </div>
  );
};
