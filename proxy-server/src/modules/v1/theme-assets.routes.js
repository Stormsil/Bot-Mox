const express = require('express');
const { success, failure } = require('../../contracts/envelope');
const { idParamSchema, themeAssetCompleteSchema, themeAssetPresignUploadSchema } = require('../../contracts/schemas');
const { asyncHandler } = require('./helpers');
const { ThemeAssetsServiceError } = require('../theme-assets/service');

function withThemeAssetErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ThemeAssetsServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createThemeAssetsRoutes({ themeAssetsService }) {
  const router = express.Router();

  if (!themeAssetsService?.enabled) {
    const reason = themeAssetsService?.reason || 'Theme assets service is not configured';
    router.use((_req, res) => {
      return res.status(503).json(failure('THEME_ASSETS_CONFIG_ERROR', reason));
    });
    return router;
  }

  router.get(
    '/',
    withThemeAssetErrors(async (req, res) => {
      const auth = req.auth || {};
      const data = await themeAssetsService.listAssets({
        tenantId: auth.tenant_id,
      });
      return res.json(success(data));
    })
  );

  router.post(
    '/presign-upload',
    withThemeAssetErrors(async (req, res) => {
      const parsedBody = themeAssetPresignUploadSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await themeAssetsService.createPresignedUpload({
        tenantId: auth.tenant_id,
        actorId: auth.uid,
        filename: parsedBody.data.filename,
        mimeType: parsedBody.data.mime_type,
        sizeBytes: parsedBody.data.size_bytes,
      });

      return res.status(201).json(success(data));
    })
  );

  router.post(
    '/complete',
    withThemeAssetErrors(async (req, res) => {
      const parsedBody = themeAssetCompleteSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await themeAssetsService.completeUpload({
        tenantId: auth.tenant_id,
        assetId: parsedBody.data.asset_id,
        width: parsedBody.data.width,
        height: parsedBody.data.height,
      });

      return res.json(success(data));
    })
  );

  router.delete(
    '/:id',
    withThemeAssetErrors(async (req, res) => {
      const parsedId = idParamSchema.safeParse(req.params?.id);
      if (!parsedId.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid id parameter', parsedId.error.flatten()));
      }

      const auth = req.auth || {};
      const data = await themeAssetsService.deleteAsset({
        tenantId: auth.tenant_id,
        assetId: parsedId.data,
      });

      return res.json(success(data));
    })
  );

  return router;
}

module.exports = {
  createThemeAssetsRoutes,
};
