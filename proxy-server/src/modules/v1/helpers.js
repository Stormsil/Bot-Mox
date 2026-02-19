const { listQuerySchema } = require('../../contracts/schemas');

function normalizeForSearch(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase();
  return '';
}

function parseListQuery(input) {
  return listQuerySchema.safeParse(input || {});
}

function applyListQuery(items, parsedQuery) {
  const page = parsedQuery.page;
  const limit = parsedQuery.limit;
  const sort = parsedQuery.sort;
  const order = parsedQuery.order || 'asc';
  const q = String(parsedQuery.q || '')
    .trim()
    .toLowerCase();

  let data = Array.isArray(items) ? [...items] : [];

  if (q) {
    data = data.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      return Object.values(item).some((value) => normalizeForSearch(value).includes(q));
    });
  }

  if (sort) {
    data.sort((left, right) => {
      const a = left?.[sort];
      const b = right?.[sort];

      if (a === b) return 0;
      if (a === undefined || a === null) return order === 'asc' ? -1 : 1;
      if (b === undefined || b === null) return order === 'asc' ? 1 : -1;

      if (a > b) return order === 'asc' ? 1 : -1;
      return order === 'asc' ? -1 : 1;
    });
  }

  const total = data.length;
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    items: data.slice(start, end),
    total,
    page,
    limit,
  };
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  parseListQuery,
  applyListQuery,
  asyncHandler,
};
