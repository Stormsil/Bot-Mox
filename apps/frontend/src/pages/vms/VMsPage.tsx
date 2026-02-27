import type React from 'react';
import { VMWorkspace } from '../../widgets/vm-workspace';
import { useVmsPageViewModel } from './hooks/useVmsPageViewModel';

export const VMsPage: React.FC = () => {
  const { workspaceProps } = useVmsPageViewModel();
  return <VMWorkspace {...workspaceProps} />;
};
