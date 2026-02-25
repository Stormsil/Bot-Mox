import type React from 'react';
import { BotPagePresenter } from './ui/BotPagePresenter';
import { useBotPageViewModel } from './useBotPageViewModel';

export const BotPage: React.FC = () => {
  const vm = useBotPageViewModel();
  return <BotPagePresenter state={vm.state} panel={vm.panel} />;
};
