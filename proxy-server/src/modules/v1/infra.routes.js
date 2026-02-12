const express = require('express');
const {
  infraCloneRequestSchema,
  infraVmConfigUpdateSchema,
  sshExecRequestSchema,
  sshVmConfigWriteSchema,
} = require('../../contracts/schemas');
const { success, failure } = require('../../contracts/envelope');
const { asyncHandler } = require('./helpers');
const { createInfraService, InfraServiceError } = require('../infra/service');
const { isSshCommandAllowed } = require('../infra/ssh-allowlist');

function withInfraErrors(handler) {
  return asyncHandler(async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof InfraServiceError) {
        return res.status(error.status).json(failure(error.code, error.message, error.details));
      }
      throw error;
    }
  });
}

function createInfraRoutes({ proxmoxLogin, proxmoxRequest, sshExec, env }) {
  const router = express.Router();
  const infraService = createInfraService({
    proxmoxLogin,
    proxmoxRequest,
    sshExec,
    env,
    isSshCommandAllowed,
  });

  router.post(
    '/proxmox/login',
    withInfraErrors(async (_req, res) => {
      const payload = await infraService.login({ forceRefresh: true });
      return res.json(success(payload));
    })
  );

  router.get(
    '/proxmox/status',
    withInfraErrors(async (_req, res) => {
      const payload = await infraService.status();
      return res.json(success(payload));
    })
  );

  router.get(
    '/proxmox/nodes/:node/qemu',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.listNodeVms({ node: req.params?.node });
      return res.json(success(payload));
    })
  );

  router.post(
    '/proxmox/nodes/:node/qemu/:vmid/clone',
    withInfraErrors(async (req, res) => {
      const parsedBody = infraCloneRequestSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const payload = await infraService.cloneVm({
        node: req.params?.node,
        vmid: req.params?.vmid,
        body: parsedBody.data,
      });

      return res.json(success(payload));
    })
  );

  router.get(
    '/proxmox/nodes/:node/qemu/:vmid/config',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.getVmConfig({
        node: req.params?.node,
        vmid: req.params?.vmid,
      });
      return res.json(success(payload));
    })
  );

  router.put(
    '/proxmox/nodes/:node/qemu/:vmid/config',
    withInfraErrors(async (req, res) => {
      const parsedBody = infraVmConfigUpdateSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const payload = await infraService.updateVmConfig({
        node: req.params?.node,
        vmid: req.params?.vmid,
        body: parsedBody.data,
      });

      return res.json(success(payload));
    })
  );

  router.get(
    '/proxmox/nodes/:node/tasks/:upid/status',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.getTaskStatus({
        node: req.params?.node,
        upid: req.params?.upid,
      });
      return res.json(success(payload));
    })
  );

  router.post(
    '/proxmox/nodes/:node/qemu/:vmid/status/:action',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.vmAction({
        node: req.params?.node,
        vmid: req.params?.vmid,
        action: req.params?.action,
      });
      return res.json(success(payload));
    })
  );

  router.delete(
    '/proxmox/nodes/:node/qemu/:vmid',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.deleteVm({
        node: req.params?.node,
        vmid: req.params?.vmid,
        purge: req.query?.purge,
        destroyUnreferencedDisks: req.query?.['destroy-unreferenced-disks'],
      });
      return res.json(success(payload));
    })
  );

  router.post(
    '/proxmox/nodes/:node/qemu/:vmid/sendkey',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.sendKey({
        node: req.params?.node,
        vmid: req.params?.vmid,
        key: req.body?.key,
      });
      return res.json(success(payload));
    })
  );

  router.get(
    '/proxmox/nodes/:node/qemu/:vmid/status/current',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.getVmCurrentStatus({
        node: req.params?.node,
        vmid: req.params?.vmid,
      });
      return res.json(success(payload));
    })
  );

  router.get(
    '/proxmox/cluster/resources',
    withInfraErrors(async (_req, res) => {
      const payload = await infraService.getClusterResources();
      return res.json(success(payload));
    })
  );

  router.post(
    '/ssh/test',
    withInfraErrors(async (_req, res) => {
      const payload = await infraService.sshTest();
      return res.json(success(payload));
    })
  );

  router.post(
    '/ssh/exec',
    withInfraErrors(async (req, res) => {
      const parsedBody = sshExecRequestSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const payload = await infraService.execSsh({
        command: parsedBody.data.command,
        timeout: parsedBody.data.timeout,
      });
      return res.json(success(payload));
    })
  );

  router.get(
    '/ssh/vm-config/:vmid',
    withInfraErrors(async (req, res) => {
      const payload = await infraService.readVmConfig({ vmid: req.params?.vmid });
      return res.json(success(payload));
    })
  );

  router.put(
    '/ssh/vm-config/:vmid',
    withInfraErrors(async (req, res) => {
      const parsedBody = sshVmConfigWriteSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json(failure('BAD_REQUEST', 'Invalid request body', parsedBody.error.flatten()));
      }

      const payload = await infraService.writeVmConfig({
        vmid: req.params?.vmid,
        content: parsedBody.data.content,
      });
      return res.json(success(payload));
    })
  );

  return router;
}

module.exports = {
  createInfraRoutes,
};
