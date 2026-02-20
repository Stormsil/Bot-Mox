import type { BotLifecycleState, BotRecord, BotStatus } from './bots.types';
import { RESTORABLE_STATUSES } from './bots.types';
import {
  createDefaultLifecycle,
  toLifecycleStageFromStatus,
  toTimestampFromRussianDate,
} from './bots.utils';

export function buildTransitionPayload(entity: BotRecord, nextStatus: BotStatus): BotRecord {
  const currentStatus = String(entity.status || 'offline') as BotStatus;
  const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
    createDefaultLifecycle()) as BotLifecycleState;
  const nextStage = toLifecycleStageFromStatus(nextStatus) || 'prepare';
  const previousStage = toLifecycleStageFromStatus(currentStatus);
  const nextTransitions = Array.isArray(lifecycle.stage_transitions)
    ? [...lifecycle.stage_transitions]
    : [];

  if (previousStage) {
    nextTransitions.push({
      from: previousStage,
      to: nextStage,
      timestamp: Date.now(),
    });
  } else {
    nextTransitions.push({
      from: 'create',
      to: nextStage,
      timestamp: Date.now(),
    });
  }

  return {
    ...entity,
    status: nextStatus,
    lifecycle: {
      ...lifecycle,
      current_stage: nextStage,
      previous_status: currentStatus,
      stage_transitions: nextTransitions,
    },
    updated_at: Date.now(),
  };
}

export function buildBanPayload(entity: BotRecord, details: Record<string, unknown>): BotRecord {
  const currentStatus = String(entity.status || 'offline');
  const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
    createDefaultLifecycle()) as BotLifecycleState;
  const nextTransitions = Array.isArray(lifecycle.stage_transitions)
    ? [...lifecycle.stage_transitions]
    : [];
  const previousStage = toLifecycleStageFromStatus(currentStatus);
  if (previousStage) {
    nextTransitions.push({
      from: previousStage,
      to: previousStage,
      timestamp: Date.now(),
    });
  }

  const banDetails = {
    ...details,
    ban_timestamp: toTimestampFromRussianDate(details.ban_date),
  };

  return {
    ...entity,
    status: 'banned',
    lifecycle: {
      ...lifecycle,
      current_stage: 'banned',
      previous_status: currentStatus,
      stage_transitions: nextTransitions,
      ban_details: banDetails,
    },
    updated_at: Date.now(),
  };
}

export function buildUnbanPayload(entity: BotRecord): BotRecord {
  const lifecycle = ((entity.lifecycle as BotLifecycleState | undefined) ||
    createDefaultLifecycle()) as BotLifecycleState;
  const previousStatus = String(lifecycle.previous_status || '').toLowerCase();
  const restoredStatus = RESTORABLE_STATUSES.has(previousStatus) ? previousStatus : 'offline';
  const restoredStage = toLifecycleStageFromStatus(restoredStatus) || 'prepare';

  return {
    ...entity,
    status: restoredStatus,
    lifecycle: {
      ...lifecycle,
      current_stage: restoredStage,
      ban_details: {
        ...lifecycle.ban_details,
        unbanned_at: Date.now(),
      },
    },
    updated_at: Date.now(),
  };
}
