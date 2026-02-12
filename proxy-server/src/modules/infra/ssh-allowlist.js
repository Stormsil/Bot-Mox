const SSH_COMMAND_ALLOWLIST = [
  /^qm\s+(status|start|stop|shutdown|reset|suspend|resume)\s+\d+$/i,
  /^qm\s+sendkey\s+\d+\s+[A-Za-z0-9_+\-]+$/i,
  /^cat\s+\/etc\/pve\/qemu-server\/\d+\.conf$/i,
  /^pvesh\s+get\s+\/nodes\/[^\s]+\/qemu\/?$/i,
  /^pvesh\s+get\s+\/cluster\/resources\/?$/i,
];

function isSshCommandAllowed(command) {
  const normalized = String(command || '').trim();
  if (!normalized) return false;
  return SSH_COMMAND_ALLOWLIST.some((rule) => rule.test(normalized));
}

module.exports = {
  isSshCommandAllowed,
};
