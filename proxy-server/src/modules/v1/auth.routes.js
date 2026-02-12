const express = require('express');
const { success, failure } = require('../../contracts/envelope');

function createAuthRoutes({ authenticate }) {
  const router = express.Router();

  router.get('/verify', authenticate, (req, res) => {
    const auth = req.auth || {};
    return res.json(
      success({
        uid: auth.uid || null,
        email: auth.email || null,
        roles: Array.isArray(auth.roles) ? auth.roles : [],
        source: auth.source || 'unknown',
        tenant_id: auth.tenant_id || 'default',
      })
    );
  });

  router.get('/whoami', authenticate, (req, res) => {
    return res.json(success(req.auth || null));
  });

  router.use((_req, res) => {
    return res.status(404).json(failure('NOT_FOUND', 'Auth endpoint not found'));
  });

  return router;
}

module.exports = {
  createAuthRoutes,
};
