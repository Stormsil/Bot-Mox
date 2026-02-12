function success(data, meta) {
  const payload = { success: true };
  if (data !== undefined) {
    payload.data = data;
  }
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return payload;
}

function failure(code, message, details) {
  const error = {
    code: String(code || 'INTERNAL_ERROR'),
    message: String(message || 'Unknown error'),
  };

  if (details !== undefined) {
    error.details = details;
  }

  return {
    success: false,
    error,
  };
}

module.exports = {
  success,
  failure,
};
