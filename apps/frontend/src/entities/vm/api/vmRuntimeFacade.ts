export { ApiClientError } from '../../../shared/api/apiClient';
export type { VmOpsCommandEvent } from '../../../shared/api/providers/vm-ops-events-client';
export { subscribeToVmOpsEvents } from '../../../shared/api/providers/vm-ops-events-client';
export {
  dispatchVmOpsViaContract,
  getVmOpsCommandViaContract,
  listAgentsViaContract,
  type VmOpsDispatchTarget,
} from '../../../shared/api/providers/vmops-contract-client';
export type { Playbook, PlaybookValidationResult } from './playbookFacade';
export {
  createPlaybook,
  deletePlaybook,
  listPlaybooks,
  updatePlaybook,
  validatePlaybook,
} from './playbookFacade';
export { setVmSettingsSecret } from './secretsFacade';
export type {
  UnattendProfile,
  UnattendProfileConfig,
  VmSetupProgressEntry,
} from './unattendProfileFacade';
export {
  createUnattendProfile,
  DEFAULT_PROFILE_CONFIG,
  deleteUnattendProfile,
  getVmSetupProgress,
  listUnattendProfiles,
  migrateProfileConfig,
  updateUnattendProfile,
} from './unattendProfileFacade';
export {
  getVmHardwareFingerprint,
  getVmHardwareFingerprintEnvelope,
  type VmHardwareFingerprintMeta,
  type VmHardwareFingerprintPayload,
} from './vmHardwareFingerprintFacade';
export {
  getClusterResources,
  getVMConfig,
  listVMs,
  proxmoxLogin,
  startAndSendKeyBatch,
  startVM,
  stopVM,
  updateVMConfig,
  waitForTask,
} from './vmReadFacade';
export {
  getSelectedProxmoxTargetId,
  getSelectedProxmoxTargetNode,
  setSelectedProxmoxTargetId,
  setSelectedProxmoxTargetNode,
} from './vmSelectionFacade';
export {
  getVMSettings,
  stripPasswords,
  updateVMSettings,
} from './vmSettingsFacade';
