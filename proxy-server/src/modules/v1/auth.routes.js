const express = require('express');
const { success, failure } = require('../../contracts/envelope');

function createAuthRoutes({ authenticate }) {
  const router = express.Router();

  router.get('/verify', authenticate, (_req, res) => {
    return res.json(success({ valid: true }));
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
