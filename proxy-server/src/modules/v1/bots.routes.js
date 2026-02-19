const express = require('express');
const {
  idParamSchema,
  botCreateSchema,
  botPatchSchema,
  botLifecycleTransitionSchema,
  banDetailsSchema,
} = require('../../contracts/schemas');
const { success, failure } = require('../../contracts/envelope');
const { parseListQuery, applyListQuery, asyncHandler } = require('./helpers');

const BOT_STATUS_TO_STAGE = {
  prepare: 'prepare',
  leveling: 'leveling',
  profession: 'profession',
  farming: 'farming',
};

const RESTORABLE_STATUSES = new Set(['offline', 'prepare', 'leveling', 'profession', 'farming']);

function toTimestampFromRussianDate(value) {
  const [day, month, year] = String(value || '')
    .trim()
    .split('.')
    .map((part) => Number(part));

  if (!day || !month || !year) {
    return Date.now();
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return Date.now();
  }

  return date.getTime();
}

function createDefaultLifecycle() {
  return {
    current_stage: 'prepare',
    stage_transitions: [],
  };
}

function toLifecycleStageFromStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  return BOT_STATUS_TO_STAGE[normalized] || null;
}

function createBotsRoutes({ repo }) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsedQuery = parseListQuery(req.query);
      if (!parsedQuery.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid query parameters', parsedQuery.error.flatten()));
      }

      const items = await repo.list();
      const result = applyListQuery(items, parsedQuery.data);

      return res.json(
        success(result.items, {
          total: result.total,
          page: result.page,
          limit: result.limit,
        }),
      );
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const entity = await repo.getById(parsedId.data.id);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      return res.json(success(entity));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsedBody = botCreateSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const explicitId = typeof parsedBody.data.id === 'string' ? parsedBody.data.id.trim() : '';
      const created = await repo.create(parsedBody.data, explicitId || undefined);
      return res.status(201).json(success(created));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const parsedBody = botPatchSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const updated = await repo.patch(parsedId.data.id, parsedBody.data);
      if (!updated) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      return res.json(success(updated));
    }),
  );

  router.get(
    '/:id/lifecycle',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const entity = await repo.getById(parsedId.data.id);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      const lifecycle = entity?.lifecycle || null;
      return res.json(success(lifecycle));
    }),
  );

  router.get(
    '/:id/lifecycle/transitions',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const entity = await repo.getById(parsedId.data.id);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      const transitions = Array.isArray(entity?.lifecycle?.stage_transitions)
        ? entity.lifecycle.stage_transitions
        : [];
      return res.json(success(transitions));
    }),
  );

  router.get(
    '/:id/lifecycle/is-banned',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const entity = await repo.getById(parsedId.data.id);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      const isBanned =
        String(entity?.status || '').toLowerCase() === 'banned' ||
        String(entity?.lifecycle?.current_stage || '').toLowerCase() === 'banned';

      return res.json(success({ banned: isBanned }));
    }),
  );

  router.post(
    '/:id/lifecycle/transition',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const parsedBody = botLifecycleTransitionSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid transition payload', parsedBody.error.flatten()));
      }

      const botId = parsedId.data.id;
      const nextStatus = parsedBody.data.status;
      if (nextStatus === 'banned') {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Use /lifecycle/ban endpoint for ban transitions'));
      }

      const entity = await repo.getById(botId);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      const currentStatus = String(entity?.status || 'offline');
      if (currentStatus === nextStatus) {
        return res.json(success(entity));
      }

      const lifecycle = entity?.lifecycle || createDefaultLifecycle();
      const nextStage = toLifecycleStageFromStatus(nextStatus) || 'prepare';
      const previousStage = toLifecycleStageFromStatus(currentStatus);
      const nextTransitions = Array.isArray(lifecycle.stage_transitions)
        ? [...lifecycle.stage_transitions]
        : [];

      if (previousStage && nextStage) {
        nextTransitions.push({
          from: previousStage,
          to: nextStage,
          timestamp: Date.now(),
        });
      } else if (!previousStage && nextStage) {
        nextTransitions.push({
          from: 'create',
          to: nextStage,
          timestamp: Date.now(),
        });
      }

      const updated = await repo.patch(botId, {
        status: nextStatus,
        lifecycle: {
          ...lifecycle,
          current_stage: nextStage,
          previous_status: currentStatus,
          stage_transitions: nextTransitions,
        },
      });

      await repo.writeLifecycleLog(
        botId,
        'status_change',
        `Status changed from ${currentStatus} to ${nextStatus}`,
        {
          from: currentStatus,
          to: nextStatus,
        },
      );

      return res.json(success(updated));
    }),
  );

  router.post(
    '/:id/lifecycle/ban',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const parsedBody = banDetailsSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid ban payload', parsedBody.error.flatten()));
      }

      const botId = parsedId.data.id;
      const entity = await repo.getById(botId);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      const currentStatus = String(entity?.status || 'offline');
      const lifecycle = entity?.lifecycle || createDefaultLifecycle();
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
        ...parsedBody.data,
        ban_timestamp: toTimestampFromRussianDate(parsedBody.data.ban_date),
      };

      const updated = await repo.patch(botId, {
        status: 'banned',
        lifecycle: {
          ...lifecycle,
          current_stage: 'banned',
          previous_status: currentStatus,
          stage_transitions: nextTransitions,
          ban_details: banDetails,
        },
      });

      await repo.writeArchiveEntry(botId, entity, banDetails);
      await repo.writeLifecycleLog(botId, 'ban', `Bot banned: ${parsedBody.data.ban_reason}`, {
        from: currentStatus,
        mechanism: parsedBody.data.ban_mechanism,
        ban_date: parsedBody.data.ban_date,
      });

      return res.json(success(updated));
    }),
  );

  router.post(
    '/:id/lifecycle/unban',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const botId = parsedId.data.id;
      const entity = await repo.getById(botId);
      if (!entity) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      const lifecycle = entity?.lifecycle || createDefaultLifecycle();
      if (!lifecycle?.ban_details) {
        return res.status(400).json(failure('BAD_REQUEST', 'Bot is not banned'));
      }

      const restoredStatus = RESTORABLE_STATUSES.has(
        String(lifecycle.previous_status || '').toLowerCase(),
      )
        ? lifecycle.previous_status
        : 'offline';
      const restoredStage = toLifecycleStageFromStatus(restoredStatus) || 'prepare';

      const updated = await repo.patch(botId, {
        status: restoredStatus,
        lifecycle: {
          ...lifecycle,
          current_stage: restoredStage,
          ban_details: {
            ...lifecycle.ban_details,
            unbanned_at: Date.now(),
          },
        },
      });

      await repo.writeLifecycleLog(
        botId,
        'unban',
        `Bot unbanned and restored to ${restoredStatus}`,
        {
          restored_status: restoredStatus,
        },
      );

      return res.json(success(updated));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params);
      if (!parsedId.success) {
        return res
          .status(400)
          .json(failure('BAD_REQUEST', 'Invalid bot id', parsedId.error.flatten()));
      }

      const deleted = await repo.remove(parsedId.data.id);
      if (!deleted) {
        return res.status(404).json(failure('NOT_FOUND', 'Bot not found'));
      }

      return res.json(success({ id: parsedId.data.id, deleted: true }));
    }),
  );

  return router;
}

module.exports = {
  createBotsRoutes,
};
