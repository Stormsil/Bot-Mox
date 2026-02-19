import { Menu, nativeImage, shell, Tray } from 'electron';
import type { AgentStatus } from '../core/agent-loop';

// ---------------------------------------------------------------------------
// Tray icon colors (16x16 colored squares generated in-memory)
// ---------------------------------------------------------------------------

function createColorIcon(r: number, g: number, b: number): Electron.NativeImage {
  if (!nativeImage || typeof nativeImage.createFromBuffer !== 'function') {
    throw new Error('Electron nativeImage API is unavailable');
  }

  // 16x16 RGBA bitmap
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    // Simple circle: color inside radius, transparent outside
    const x = i % size;
    const y = Math.floor(i / size);
    const cx = size / 2,
      cy = size / 2,
      radius = 6;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist <= radius) {
      buf[i * 4] = r;
      buf[i * 4 + 1] = g;
      buf[i * 4 + 2] = b;
      buf[i * 4 + 3] = 255;
    }
    // else stays transparent (0,0,0,0)
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createIcons(): Record<AgentStatus, Electron.NativeImage> {
  return {
    idle: createColorIcon(128, 128, 128), // gray
    connecting: createColorIcon(255, 200, 0), // yellow
    online: createColorIcon(0, 180, 0), // green
    error: createColorIcon(220, 50, 50), // red
    revoked: createColorIcon(100, 100, 100), // dark gray
  };
}

const statusLabels: Record<AgentStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting...',
  online: 'Online',
  error: 'Connection Error',
  revoked: 'Revoked',
};

// ---------------------------------------------------------------------------
// AgentTray
// ---------------------------------------------------------------------------

export class AgentTray {
  private tray: Tray;
  private icons: Record<AgentStatus, Electron.NativeImage>;
  private status: AgentStatus = 'idle';
  private agentName = 'Not paired';
  private statusMessage = '';
  private onRepair: (() => void) | null = null;
  private onLogout: (() => void) | null = null;
  private onQuit: (() => void) | null = null;
  private onCreateDiagnosticBundle: (() => void) | null = null;
  private logPath = '';

  constructor() {
    this.icons = createIcons();
    this.tray = new Tray(this.icons.idle);
    this.tray.setToolTip('Bot-Mox Agent');
    this.rebuildMenu();
  }

  setCallbacks(opts: {
    onCreateDiagnosticBundle: () => void;
    onRepair: () => void;
    onLogout: () => void;
    onQuit: () => void;
    logPath: string;
  }): void {
    this.onCreateDiagnosticBundle = opts.onCreateDiagnosticBundle;
    this.onRepair = opts.onRepair;
    this.onLogout = opts.onLogout;
    this.onQuit = opts.onQuit;
    this.logPath = opts.logPath;
    this.rebuildMenu();
  }

  updateStatus(status: AgentStatus, message?: string): void {
    this.status = status;
    this.statusMessage = message || '';
    this.tray.setImage(this.icons[status]);
    this.tray.setToolTip(`Bot-Mox Agent — ${statusLabels[status]}`);
    this.rebuildMenu();
  }

  setAgentName(name: string): void {
    this.agentName = name;
    this.rebuildMenu();
  }

  private rebuildMenu(): void {
    const statusText = this.statusMessage
      ? `${statusLabels[this.status]} (${this.statusMessage})`
      : statusLabels[this.status];

    const menu = Menu.buildFromTemplate([
      { label: `Status: ${statusText}`, enabled: false },
      { label: `Agent: ${this.agentName}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Pair Again...',
        click: () => this.onRepair?.(),
      },
      {
        label: 'Log Out',
        click: () => this.onLogout?.(),
      },
      {
        label: 'Open Logs',
        click: () => {
          if (this.logPath) shell.openPath(this.logPath);
        },
      },
      {
        label: 'Create Diagnostic Bundle',
        click: () => this.onCreateDiagnosticBundle?.(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.onQuit?.(),
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    this.tray.destroy();
  }
}
