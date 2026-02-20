import {
  getVMStatus,
  sendVMKey,
  startVM,
  waitForTask,
  waitForVmStatus,
} from './vmService/proxmoxOps';
import { isRunningStatus, sleep } from './vmService/proxmoxUtils';
import {
  type StartAndSendKeyBatchResult,
  type StartAndSendKeyOptions,
  startAndSendKeyBatchWithDeps,
} from './vmService/startAndSendKey';

export {
  cloneVM,
  type DeleteVMOptions,
  deleteVM,
  getClusterResources,
  getProxmoxConnectionSnapshot,
  getVMConfig,
  getVMStatus,
  listProxmoxTargets,
  listVMs,
  type ProxmoxConnectionSnapshot,
  type ProxmoxTargetInfo,
  pollTaskStatus,
  proxmoxLogin,
  resizeVMDisk,
  sendVMKey,
  startVM,
  stopVM,
  testProxmoxConnection,
  updateVMConfig,
  waitForTask,
  waitForVmPresence,
  waitForVmStatus,
} from './vmService/proxmoxOps';
export {
  registerVmResource,
  type VmResourceRegistrationPayload,
} from './vmService/resourceRegistry';
export type { SshConnectionStatus } from './vmService/sshOps';
export {
  executeSSH,
  getSshConnectionStatus,
  readVMConfig,
  testSSHConnection,
  writeVMConfig,
} from './vmService/sshOps';
export type {
  StartAndSendKeyBatchResult,
  StartAndSendKeyOptions,
  StartAndSendKeyResultItem,
} from './vmService/startAndSendKey';

export async function startAndSendKeyBatch(
  vmIds: number[],
  options: StartAndSendKeyOptions = {},
): Promise<StartAndSendKeyBatchResult> {
  return startAndSendKeyBatchWithDeps(vmIds, options, {
    sleep,
    isRunningStatus,
    getVMStatus,
    waitForVmStatus,
    waitForTask,
    startVM,
    sendVMKey,
  });
}
