function parseBearerToken(value) {
  if (!value || typeof value !== 'string') return '';
  const [scheme, token] = value.trim().split(' ');
  if (!scheme || !token) return '';
  if (scheme.toLowerCase() !== 'bearer') return '';
  return token.trim();
}

module.exports = {
  parseBearerToken,
};
