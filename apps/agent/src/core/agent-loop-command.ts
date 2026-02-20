import { randomUUID } from 'node:crypto';
import { executeCommand } from '../executors';
import type { ApiClient } from './api-client';
import type { AgentConfig } from './config-store';
import type { Logger } from './logger';
import type { QueuedCommand } from './schemas';

export type ProcessCommandResult = 'done' | 'skipped' | 'rate_limited';

export interface ProcessCommandDependencies {
  config: AgentConfig;
  apiClient: ApiClient;
  logger: Logger;
  reportWsEvent: (payload: Record<string, unknown>, expectedType: string) => Promise<boolean>;
  isRateLimitedError: (err: unknown) => boolean;
}

export async function processQueuedCommand(
  cmd: QueuedCommand,
  deps: ProcessCommandDependencies,
): Promise<ProcessCommandResult> {
  deps.logger.info(`Executing command ${cmd.id} (${cmd.command_type})`);

  if (cmd.expires_at && new Date(cmd.expires_at) < new Date()) {
    deps.logger.warn(`Command ${cmd.id} already expired, skipping`);
    try {
      await deps.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'failed',
        error_message: 'Command expired before execution',
      });
    } catch (reportErr) {
      deps.logger.error(`Failed to mark expired command ${cmd.id}:`, reportErr);
    }
    return 'skipped';
  }

  const runningReportedViaWs = await deps.reportWsEvent(
    {
      type: 'agent.command.ack',
      request_id: randomUUID(),
      command_id: cmd.id,
      agent_id: deps.config.agentId,
    },
    'agent.command.ack',
  );

  if (!runningReportedViaWs) {
    try {
      await deps.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'running',
      });
    } catch (err) {
      if (deps.isRateLimitedError(err)) {
        deps.logger.warn(
          `Rate limited while claiming command ${cmd.id}, delaying further processing`,
        );
        return 'rate_limited';
      }
      deps.logger.error(`Failed to mark command ${cmd.id} as running:`, err);
      return 'skipped';
    }
  }

  try {
    const result = await executeCommand(
      cmd.command_type,
      cmd.payload || {},
      deps.config,
      deps.logger,
    );
    const successReportedViaWs = await deps.reportWsEvent(
      {
        type: 'agent.command.result',
        request_id: randomUUID(),
        command_id: cmd.id,
        agent_id: deps.config.agentId,
        status: 'succeeded',
        result: result ?? {},
      },
      'agent.command.result',
    );

    if (!successReportedViaWs) {
      await deps.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'succeeded',
        result: result ?? {},
      });
    }

    deps.logger.info(`Command ${cmd.id} succeeded`);
    return 'done';
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    deps.logger.error(`Command ${cmd.id} failed: ${errorMessage}`);

    try {
      const failureReportedViaWs = await deps.reportWsEvent(
        {
          type: 'agent.command.result',
          request_id: randomUUID(),
          command_id: cmd.id,
          agent_id: deps.config.agentId,
          status: 'failed',
          error_message: errorMessage,
        },
        'agent.command.result',
      );

      if (!failureReportedViaWs) {
        await deps.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
          status: 'failed',
          error_message: errorMessage,
        });
      }
    } catch (reportErr) {
      deps.logger.error(`Failed to report error for command ${cmd.id}:`, reportErr);
    }

    if (deps.isRateLimitedError(err)) {
      return 'rate_limited';
    }
    return 'done';
  }
}
