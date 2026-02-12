import { useEffect } from 'react';

interface VMKeyboardActions {
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onAddVM: () => void;
  onCopyLog: () => void;
}

export function useVMKeyboardShortcuts(actions: VMKeyboardActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // F5 or Ctrl+S — Start processing
      if (e.key === 'F5' || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        actions.onStart();
        return;
      }

      // F6 or Ctrl+E — Stop/Cancel
      if (e.key === 'F6' || (e.ctrlKey && e.key === 'e')) {
        e.preventDefault();
        actions.onStop();
        return;
      }

      // F7 or Ctrl+R — Reset
      if (e.key === 'F7' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        actions.onReset();
        return;
      }

      // Ctrl+N — Add VM
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        actions.onAddVM();
        return;
      }

      // Ctrl+L — Copy log
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        actions.onCopyLog();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
