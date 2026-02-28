import type React from 'react';
import type { LifeStage } from './config';
import { StageFarmPanel } from './StageFarmPanel';
import { StageLevelingPanel } from './StageLevelingPanel';
import { StagePreparePanel } from './StagePreparePanel';
import { StageProfessionsPanel } from './StageProfessionsPanel';

interface StagePanelsProps {
  currentStage: LifeStage;
  renderTimestamp: number;
  formatDuration: (ms: number) => string;
}

export const StagePanels: React.FC<StagePanelsProps> = ({
  currentStage,
  renderTimestamp,
  formatDuration,
}) => {
  switch (currentStage) {
    case 'prepare':
      return <StagePreparePanel isBanned={false} />;
    case 'banned':
      return <StagePreparePanel isBanned />;
    case 'leveling':
      return <StageLevelingPanel />;
    case 'professions':
      return <StageProfessionsPanel />;
    case 'farm':
      return <StageFarmPanel renderTimestamp={renderTimestamp} formatDuration={formatDuration} />;
    default:
      return <StagePreparePanel isBanned={currentStage === 'banned'} />;
  }
};
