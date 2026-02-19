const INVALID_PATH_SEGMENT_PATTERN = /[.#$[\]/]/;

function sanitizePathSegment(input, fallback = 'default') {
  const candidate = String(input || '').trim();
  if (!candidate) return fallback;
  if (INVALID_PATH_SEGMENT_PATTERN.test(candidate)) {
    return fallback;
  }
  return candidate;
}

function buildTenantPath(tenantId, ...segments) {
  const normalizedTenantId = sanitizePathSegment(tenantId, 'default');
  const normalizedSegments = segments
    .map((segment) => sanitizePathSegment(segment, ''))
    .filter(Boolean);

  if (normalizedSegments.length === 0) {
    return `tenants/${normalizedTenantId}`;
  }

  return `tenants/${normalizedTenantId}/${normalizedSegments.join('/')}`;
}

module.exports = {
  buildTenantPath,
  sanitizePathSegment,
};
