import type React from 'react';

export const VMQueueColumnsHeader: React.FC<{
  className: (classNames: string) => string;
}> = ({ className }) => {
  return (
    <div className={className('vm-queue-columns')}>
      <span className={className('vm-queue-columns-name')}>VM</span>
      <span>STORAGE</span>
      <span>PROJECT</span>
      <span>RESOURCES</span>
      <span className={className('vm-queue-columns-unattend')}>UNATTEND</span>
      <span className={className('vm-queue-columns-playbook')}>PLAYBOOK</span>
      <span className={className('vm-queue-columns-status')}>STATE</span>
      <span className={className('vm-queue-columns-remove')} />
    </div>
  );
};
