class RtdbCollectionRepository {
  constructor(admin, collectionPath) {
    this.admin = admin;
    this.collectionPath = collectionPath;
  }

  collectionRef() {
    return this.admin.database().ref(this.collectionPath);
  }

  static normalizeCollectionMap(rawValue) {
    if (!rawValue || typeof rawValue !== 'object') return [];

    return Object.entries(rawValue).map(([id, value]) => {
      const payload = value && typeof value === 'object' ? value : { value };
      return {
        id,
        ...payload,
      };
    });
  }

  async list() {
    const snapshot = await this.collectionRef().once('value');
    const rawValue = snapshot.val();
    return RtdbCollectionRepository.normalizeCollectionMap(rawValue);
  }

  async getById(id) {
    const snapshot = await this.collectionRef().child(String(id)).once('value');
    if (!snapshot.exists()) return null;

    const value = snapshot.val();
    return {
      id: String(id),
      ...(value && typeof value === 'object' ? value : { value }),
    };
  }

  async create(payload, explicitId) {
    const now = Date.now();
    const basePayload = {
      ...(payload || {}),
      created_at: payload?.created_at ?? now,
      updated_at: now,
    };

    const targetRef = explicitId
      ? this.collectionRef().child(String(explicitId))
      : this.collectionRef().push();

    await targetRef.set(basePayload);

    return {
      id: String(targetRef.key),
      ...basePayload,
    };
  }

  async patch(id, payload) {
    const now = Date.now();
    const updates = {
      ...(payload || {}),
      updated_at: now,
    };

    const targetRef = this.collectionRef().child(String(id));
    await targetRef.update(updates);

    const snapshot = await targetRef.once('value');
    if (!snapshot.exists()) return null;

    const current = snapshot.val();
    return {
      id: String(id),
      ...(current && typeof current === 'object' ? current : { value: current }),
    };
  }

  async remove(id) {
    const targetRef = this.collectionRef().child(String(id));
    const snapshot = await targetRef.once('value');
    if (!snapshot.exists()) return false;
    await targetRef.remove();
    return true;
  }
}

async function readRtdbPath(admin, path) {
  const snapshot = await admin.database().ref(path).once('value');
  return snapshot.val();
}

async function writeRtdbPath(admin, path, payload, options = {}) {
  const now = Date.now();
  const merge = options.merge !== false;
  const nextPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...payload, updated_at: payload.updated_at ?? now }
      : payload;

  const ref = admin.database().ref(path);
  if (merge && nextPayload && typeof nextPayload === 'object' && !Array.isArray(nextPayload)) {
    await ref.update(nextPayload);
  } else {
    await ref.set(nextPayload);
  }

  const snapshot = await ref.once('value');
  return snapshot.val();
}

module.exports = {
  RtdbCollectionRepository,
  readRtdbPath,
  writeRtdbPath,
};
