import { apiPost } from '../apiClient';

export interface VmResourceRegistrationPayload {
  vmUuid: string;
  vmName: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export async function registerVmResource(
  payload: VmResourceRegistrationPayload,
): Promise<{ vm_uuid: string; user_id: string; status: string }> {
  const vmUuid = String(payload.vmUuid || '')
    .trim()
    .toLowerCase();
  if (!vmUuid) {
    throw new Error('vmUuid is required for VM resource registration');
  }

  const vmName = String(payload.vmName || '').trim();
  const projectId = String(payload.projectId || '').trim();

  const response = await apiPost<{ vm_uuid: string; user_id: string; status: string }>(
    '/api/v1/vm/register',
    {
      vm_uuid: vmUuid,
      vm_name: vmName || undefined,
      project_id: projectId || undefined,
      status: 'active',
      metadata:
        payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : undefined,
    },
  );

  return response.data;
}
