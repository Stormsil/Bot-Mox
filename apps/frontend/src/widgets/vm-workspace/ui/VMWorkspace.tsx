import type React from 'react';
import { useRef, useState } from 'react';
import { useVmWorkspaceLayout } from '../model/useVmWorkspaceLayout';
import { cx } from './cx';

type PanelOpenState = 'settings' | null;

export interface VMWorkspaceShellRenderContext {
  panelOpen: PanelOpenState;
  setPanelOpen: React.Dispatch<React.SetStateAction<PanelOpenState>>;
  openSettings: () => void;
}

interface VMWorkspaceProps {
  renderStatusBar: (context: VMWorkspaceShellRenderContext) => React.ReactNode;
  targetStrip: React.ReactNode;
  servicePane: React.ReactNode;
  queuePane: React.ReactNode;
  logPane: React.ReactNode;
  renderModals: (context: VMWorkspaceShellRenderContext) => React.ReactNode;
}

export const VMWorkspace: React.FC<VMWorkspaceProps> = ({
  renderStatusBar,
  targetStrip,
  servicePane,
  queuePane,
  logPane,
  renderModals,
}) => {
  const [panelOpen, setPanelOpen] = useState<PanelOpenState>(null);
  const workspaceLayoutRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const {
    workspaceGridTemplateColumns,
    isWorkspaceResizing,
    startWorkspaceResize,
    logHeight,
    isLogResizing,
    startLogResize,
  } = useVmWorkspaceLayout({
    workspaceLayoutRef,
    workspaceRef,
  });

  const renderContext: VMWorkspaceShellRenderContext = {
    panelOpen,
    setPanelOpen,
    openSettings: () => {
      setPanelOpen('settings');
    },
  };

  return (
    <div className={cx(`vm-generator ${isLogResizing ? 'vm-generator--resizing' : ''}`)}>
      {renderStatusBar(renderContext)}

      {targetStrip}

      <div
        ref={workspaceLayoutRef}
        className={cx(
          `vm-generator-workspace${isWorkspaceResizing ? ' vm-generator-workspace--resizing' : ''}`,
        )}
        style={{ gridTemplateColumns: workspaceGridTemplateColumns }}
      >
        <div className={cx('vm-generator-service-pane')}>{servicePane}</div>

        <button
          type="button"
          className={cx('vm-generator-workspace-resizer')}
          aria-label="Resize workspace panes"
          onMouseDown={startWorkspaceResize}
        />

        <div ref={workspaceRef} className={cx('vm-generator-main')}>
          <div className={cx('vm-generator-queue-wrap')}>{queuePane}</div>

          <button
            type="button"
            className={cx('vm-generator-log-resizer')}
            onMouseDown={startLogResize}
            aria-label="Resize log panel"
          />

          <div className={cx('vm-generator-log-wrap')} style={{ height: logHeight }}>
            {logPane}
          </div>
        </div>
      </div>

      {renderModals(renderContext)}
    </div>
  );
};
