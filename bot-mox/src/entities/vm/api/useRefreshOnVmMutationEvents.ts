import { useEffect, useRef } from 'react';
import { subscribeToVmOpsEvents } from './vmLegacyFacade';

type MutationRefreshOptions = {
  onMutationTerminalEvent: () => void | Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 500;
const VM_MUTATION_COMMANDS = new Set([
  'proxmox.clone',
  'proxmox.delete',
  'proxmox.start',
  'proxmox.stop',
  'proxmox.update-config',
  'proxmox.ssh-write-config',
]);
const VM_TERMINAL_COMMAND_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'expired']);

export function useRefreshOnVmMutationEvents({
  onMutationTerminalEvent,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}: MutationRefreshOptions): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribe = subscribeToVmOpsEvents((event) => {
      const commandType = String(event.command?.command_type || '')
        .trim()
        .toLowerCase();
      const commandStatus = String(event.command?.status || '')
        .trim()
        .toLowerCase();

      if (
        !VM_MUTATION_COMMANDS.has(commandType) ||
        !VM_TERMINAL_COMMAND_STATUSES.has(commandStatus)
      ) {
        return;
      }
      if (debounceRef.current) {
        return;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void onMutationTerminalEvent();
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [debounceMs, enabled, onMutationTerminalEvent]);
}
