function normalizeBaseTarget(value, fallback) {
  return String(value || fallback || '')
    .trim()
    .replace(/\/+$/, '');
}

function createUiTargets() {
  let proxmoxUITarget = normalizeBaseTarget(
    process.env.PROXMOX_URL || process.env.PROXMOX_UI_TARGET,
    'https://127.0.0.1:8006',
  );
  let tinyFMUITarget = normalizeBaseTarget(
    process.env.TINYFM_URL || process.env.TINYFM_UI_TARGET,
    'http://127.0.0.1:8080',
  );
  let syncThingUITarget = normalizeBaseTarget(
    process.env.SYNCTHING_URL || process.env.SYNCTHING_UI_TARGET,
    'https://127.0.0.1:8384',
  );

  return {
    getProxmoxTarget: () => proxmoxUITarget,
    setProxmoxTarget: (value) => {
      proxmoxUITarget = String(value || proxmoxUITarget);
    },
    getTinyFmTarget: () => tinyFMUITarget,
    setTinyFmTarget: (value) => {
      tinyFMUITarget = String(value || tinyFMUITarget);
    },
    getSyncThingTarget: () => syncThingUITarget,
    setSyncThingTarget: (value) => {
      syncThingUITarget = String(value || syncThingUITarget);
    },
  };
}

module.exports = {
  createUiTargets,
};
