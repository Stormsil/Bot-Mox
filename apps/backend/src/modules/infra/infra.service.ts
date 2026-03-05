import { Injectable, Optional } from '@nestjs/common';
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';
import { DOMAIN_EVENT_TYPES } from '../eventing/domain-events.contracts';
import { DurableEventBusService } from '../eventing/durable-event-bus.service';
import { generateMac } from '../vm/hardware-generator/generate-mac';
import { generateSmbios } from '../vm/hardware-generator/generate-smbios';
import { generateSsdSerial } from '../vm/hardware-generator/generate-ssd-serial';
import { InfraServiceError } from './infra.errors';
import { InfraRepository } from './infra.repository';
import type {
  CloneVmInput,
  DeleteVmInput,
  ExecSshInput,
  UpdateVmConfigInput,
  VmPatchApplyInput,
  VmPatchPlan,
  VmPatchPlanInput,
  VmRecord,
  WriteVmConfigInput,
} from './infra.types';
import {
  assertCommand,
  assertContent,
  assertNode,
  assertVmid,
  isSshCommandAllowlisted,
  normalizeTenantId,
  normalizeVmAction,
  parseTimeoutMs,
  resolveVmStatusByAction,
} from './infra.utils';
import { patchVmConfig } from './vm-config-patcher';

@Injectable()
export class InfraService {
  private taskSequence = 0;
  private readonly atRestCrypto = new DataAtRestCrypto();

  constructor(
    private readonly repository: InfraRepository,
    @Optional() private readonly eventBus?: DurableEventBusService,
  ) {}

  private decodeVmConfigContent(value: string): string {
    const source = String(value ?? '');
    if (!source.trim()) {
      return source;
    }
    try {
      const parsed = JSON.parse(source) as unknown;
      const decrypted = this.atRestCrypto.decryptString(parsed);
      return decrypted === null ? source : decrypted;
    } catch {
      return source;
    }
  }

  private encodeVmConfigContent(value: string): string {
    const envelope = this.atRestCrypto.encryptString(value);
    return JSON.stringify(envelope);
  }

  private nextUpid(): string {
    this.taskSequence += 1;
    return `UPID:nest:${Date.now().toString(16)}:${this.taskSequence}:mock-task`;
  }

  private hashSeed(seed: string | number): number {
    const source = String(seed);
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }
    return hash === 0 ? 1337 : hash;
  }

  private createSeededRandom(seed: string | number): () => number {
    let value = this.hashSeed(seed) % 2147483647;
    if (value <= 0) {
      value += 2147483646;
    }
    return () => {
      value = (value * 48271) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private readStringField(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = String(source[key] ?? '').trim();
      if (value) {
        return value;
      }
    }
    return '';
  }

  private deriveVmName(input: {
    configText: string;
    intent: Record<string, unknown>;
    profile: Record<string, unknown>;
    template: Record<string, unknown>;
    vmid: string;
  }): string {
    const byPayload =
      this.readStringField(input.intent, ['vm_name', 'name']) ||
      this.readStringField(input.profile, ['vm_name', 'name']) ||
      this.readStringField(input.template, ['vm_name', 'name']);
    if (byPayload) {
      return byPayload;
    }

    const byConfig =
      input.configText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.toLowerCase().startsWith('name:'))
        ?.split(':')
        .slice(1)
        .join(':')
        .trim() || '';
    if (byConfig) {
      return byConfig;
    }

    return `vm-${input.vmid}`;
  }

  private deriveHardwarePatchValues(input: {
    intent: Record<string, unknown>;
    profile: Record<string, unknown>;
    template: Record<string, unknown>;
  }): { mac: string; ssdSerial: string; smbiosArgs: string } {
    const intentHardware = this.toRecord(input.intent.hardware);
    const profileHardware = this.toRecord(input.profile.hardware);
    const templateHardware = this.toRecord(input.template.hardware);

    const pick = (keys: string[]): string => {
      return (
        this.readStringField(input.intent, keys) ||
        this.readStringField(intentHardware, keys) ||
        this.readStringField(input.profile, keys) ||
        this.readStringField(profileHardware, keys) ||
        this.readStringField(input.template, keys) ||
        this.readStringField(templateHardware, keys)
      );
    };

    const generatedSmbios = generateSmbios();
    return {
      mac: pick(['mac', 'generatedMac']) || generateMac(),
      ssdSerial: pick(['ssdSerial', 'generatedSerial', 'serial']) || generateSsdSerial(),
      smbiosArgs: pick(['smbiosArgs', 'argsBlock', 'args']) || generatedSmbios.args,
    };
  }

  private coerceSeedVmid(value: number | string): number | undefined {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private normalizePatchSeed(seed: number | string | undefined): number | string | undefined {
    if (seed === undefined || seed === null) {
      return undefined;
    }
    const normalized = String(seed).trim();
    return normalized.length > 0 ? (seed as number | string) : undefined;
  }

  private async buildVmPatchPlan(
    tenantId: string,
    input: VmPatchPlanInput,
  ): Promise<{
    vmid: number | string;
    node?: string;
    vm_uuid?: string;
    patch: VmPatchPlan;
    warnings?: string[];
  }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const vmid = input.vmid;
    const normalizedVmid = assertVmid(String(vmid));
    const normalizedSeed = this.normalizePatchSeed(input.seed);

    const configText =
      String(input.current_config ?? '').trim().length > 0
        ? String(input.current_config)
        : (await this.readVmConfig(normalizedTenantId, normalizedVmid)).config;

    const intent = this.toRecord(input.intent);
    const profile = this.toRecord(input.profile);
    const template = this.toRecord(input.template);
    const vmName = this.deriveVmName({
      configText,
      intent,
      profile,
      template,
      vmid: normalizedVmid,
    });
    const hardware = this.deriveHardwarePatchValues({ intent, profile, template });

    const random =
      normalizedSeed !== undefined ? this.createSeededRandom(normalizedSeed) : Math.random;
    const patch = patchVmConfig(configText, vmName, hardware, this.coerceSeedVmid(vmid), random);

    const warnings: string[] = [];
    if (!String(input.current_config ?? '').trim()) {
      warnings.push('CONFIG_SOURCE_FALLBACK_READ');
    }

    return {
      vmid,
      ...(input.node ? { node: input.node } : {}),
      ...(input.vm_uuid ? { vm_uuid: input.vm_uuid } : {}),
      patch,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  private async ensureVm(tenantId: string, node: string, vmid: string): Promise<VmRecord> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedNode = assertNode(node);
    const normalizedVmid = String(vmid).trim();

    const existing = await this.repository.findVm(
      normalizedTenantId,
      normalizedNode,
      normalizedVmid,
    );
    if (existing) {
      return existing;
    }

    const created: VmRecord = {
      node: normalizedNode,
      vmid: normalizedVmid,
      name: `vm-${normalizedVmid}`,
      status: 'running',
      config: {
        cores: 2,
        memory: 4096,
      },
    };

    return this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: created.node,
      vmid: created.vmid,
      payload: created,
    });
  }

  async login(tenantId: string): Promise<{ connected: true }> {
    normalizeTenantId(tenantId);
    return { connected: true };
  }

  async status(tenantId: string): Promise<{ connected: true; version: Record<string, unknown> }> {
    normalizeTenantId(tenantId);
    return {
      connected: true,
      version: {
        product: 'proxmox-mock',
        release: '8.x',
      },
    };
  }

  async listNodeVms(tenantId: string, node: string): Promise<Array<Record<string, unknown>>> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedNode = assertNode(node);

    const records = await this.repository.listVmsByNode(normalizedTenantId, normalizedNode);
    if (records.length === 0) {
      return [
        {
          vmid: 100,
          name: 'template-100',
          status: 'stopped',
          node: normalizedNode,
        },
      ];
    }

    return records.map((record) => ({
      vmid: Number(record.vmid),
      name: record.name,
      status: record.status,
      node: record.node,
    }));
  }

  async cloneVm(tenantId: string, input: CloneVmInput): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const sourceVm = await this.ensureVm(normalizedTenantId, input.node, input.vmid);

    const targetVmid = String(input.body.newid || '').trim();
    if (!targetVmid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'newid is required');
    }

    const targetName = String(input.body.name || `vm-${targetVmid}`).trim();
    const targetNode = String(input.node || sourceVm.node).trim();

    const cloned: VmRecord = {
      ...sourceVm,
      node: targetNode,
      vmid: targetVmid,
      name: targetName || `vm-${targetVmid}`,
      status: 'stopped',
      config: {
        ...sourceVm.config,
        ...(input.body.storage ? { storage: String(input.body.storage).trim() } : {}),
        ...(input.body.format ? { format: String(input.body.format).trim() } : {}),
        ...(input.body.full !== undefined ? { full: input.body.full } : {}),
      },
    };

    await this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: cloned.node,
      vmid: cloned.vmid,
      payload: cloned,
    });

    return {
      upid: this.nextUpid(),
    };
  }

  async getVmConfig(
    tenantId: string,
    node: string,
    vmid: string,
  ): Promise<Record<string, unknown>> {
    const vm = await this.ensureVm(tenantId, node, vmid);
    return {
      vmid: Number(vm.vmid),
      name: vm.name,
      status: vm.status,
      ...vm.config,
    };
  }

  async updateVmConfig(tenantId: string, input: UpdateVmConfigInput): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const vm = await this.ensureVm(normalizedTenantId, input.node, input.vmid);

    const merged: VmRecord = {
      ...vm,
      config: {
        ...vm.config,
        ...(input.body || {}),
      },
    };

    await this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: merged.node,
      vmid: merged.vmid,
      payload: merged,
    });

    return {
      upid: this.nextUpid(),
    };
  }

  async getTaskStatus(
    tenantId: string,
    node: string,
    upid: string,
  ): Promise<Record<string, unknown>> {
    normalizeTenantId(tenantId);
    const normalizedNode = assertNode(node);
    const normalizedUpid = String(upid || '').trim();
    if (!normalizedUpid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'upid is required');
    }

    return {
      upid: normalizedUpid,
      node: normalizedNode,
      status: 'stopped',
      exitstatus: 'OK',
    };
  }

  async vmAction(
    tenantId: string,
    node: string,
    vmid: string,
    action: string,
  ): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedAction = normalizeVmAction(action);

    const vm = await this.ensureVm(normalizedTenantId, node, vmid);
    const nextVm: VmRecord = {
      ...vm,
      status: resolveVmStatusByAction(vm.status, normalizedAction),
    };

    await this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: nextVm.node,
      vmid: nextVm.vmid,
      payload: nextVm,
    });

    return {
      upid: this.nextUpid(),
    };
  }

  async deleteVm(tenantId: string, input: DeleteVmInput): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const node = String(input.node).trim();
    const vmid = String(input.vmid).trim();
    const aggregateId = `${node}:${vmid}`;

    await this.eventBus?.publish({
      type: DOMAIN_EVENT_TYPES.VM_DELETE_REQUESTED,
      tenantId: normalizedTenantId,
      aggregateId,
      payload: {
        node,
        vmid,
      },
    });

    await this.repository
      .deleteVm(normalizedTenantId, node, vmid)
      .then(async () => {
        await this.eventBus?.publish({
          type: DOMAIN_EVENT_TYPES.VM_DELETED,
          tenantId: normalizedTenantId,
          aggregateId,
          payload: {
            node,
            vmid,
          },
        });
      })
      .catch(async (error) => {
        await this.eventBus?.publish({
          type: DOMAIN_EVENT_TYPES.VM_DELETE_FAILED,
          tenantId: normalizedTenantId,
          aggregateId,
          payload: {
            node,
            vmid,
            reason: 'repository_error',
            details: (error as Error)?.message || String(error),
          },
        });
      });

    return {
      upid: this.nextUpid(),
    };
  }

  async planVmConfigPatch(
    tenantId: string,
    input: VmPatchPlanInput,
  ): Promise<{
    vmid: number | string;
    node?: string;
    vm_uuid?: string;
    patch: VmPatchPlan;
    warnings?: string[];
  }> {
    return this.buildVmPatchPlan(tenantId, input);
  }

  async applyVmConfigPatch(
    tenantId: string,
    input: VmPatchApplyInput,
  ): Promise<{
    vmid: number | string;
    node?: string;
    vm_uuid?: string;
    applied: boolean;
    patch: VmPatchPlan;
    warnings?: string[];
    task_id?: string;
  }> {
    const plan = await this.buildVmPatchPlan(tenantId, input);
    const shouldApply = input.apply !== false && input.dry_run !== true;

    if (shouldApply) {
      await this.writeVmConfig(tenantId, {
        vmid: String(input.vmid),
        content: plan.patch.patched,
      });
    }

    return {
      vmid: plan.vmid,
      ...(plan.node ? { node: plan.node } : {}),
      ...(plan.vm_uuid ? { vm_uuid: plan.vm_uuid } : {}),
      applied: shouldApply,
      patch: plan.patch,
      ...(plan.warnings ? { warnings: plan.warnings } : {}),
      ...(shouldApply ? { task_id: this.nextUpid() } : {}),
    };
  }

  async sendKey(
    tenantId: string,
    node: string,
    vmid: string,
    key: string,
  ): Promise<{ transport: string; upid: string | null }> {
    await this.ensureVm(tenantId, node, vmid);
    const normalizedKey = String(key).trim();
    if (!normalizedKey) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'key is required');
    }

    return {
      transport: 'proxmox-api-mock',
      upid: null,
    };
  }

  async getVmCurrentStatus(
    tenantId: string,
    node: string,
    vmid: string,
  ): Promise<Record<string, unknown>> {
    const vm = await this.ensureVm(tenantId, node, vmid);
    return {
      vmid: Number(vm.vmid),
      status: vm.status,
      qmpstatus: vm.status === 'running' ? 'running' : 'stopped',
      node: vm.node,
      name: vm.name,
    };
  }

  async getClusterResources(tenantId: string): Promise<Array<Record<string, unknown>>> {
    normalizeTenantId(tenantId);
    return [
      {
        id: 'node/pve',
        type: 'node',
        node: 'pve',
        status: 'online',
      },
      {
        id: 'storage/local-lvm',
        type: 'storage',
        node: 'pve',
        storage: 'local-lvm',
        status: 'available',
      },
    ];
  }

  async sshTest(tenantId: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    normalizeTenantId(tenantId);
    return {
      stdout: 'SSH connection OK',
      stderr: '',
      exitCode: 0,
    };
  }

  async execSsh(
    tenantId: string,
    input: ExecSshInput,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    allowlisted: boolean;
  }> {
    normalizeTenantId(tenantId);
    const command = assertCommand(String(input.command || ''));

    const allowlisted = isSshCommandAllowlisted(command);
    if (!allowlisted) {
      throw new InfraServiceError(
        403,
        'SSH_COMMAND_FORBIDDEN',
        'Command is not allowlisted. Set SSH_EXEC_ALLOW_UNSAFE=true for emergency bypass.',
      );
    }

    const timeoutMs = parseTimeoutMs(input.timeout, 30_000);

    return {
      stdout: `Executed (${timeoutMs}ms): ${command}`,
      stderr: '',
      exitCode: 0,
      allowlisted,
    };
  }

  async readVmConfig(tenantId: string, vmid: string): Promise<{ config: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedVmid = assertVmid(vmid);

    const existing = await this.repository.findVmConfig(normalizedTenantId, normalizedVmid);
    if (existing) {
      return { config: this.decodeVmConfigContent(existing) };
    }

    return {
      config: `cores: 2\nmemory: 4096\nname: vm-${normalizedVmid}\n`,
    };
  }

  async writeVmConfig(tenantId: string, input: WriteVmConfigInput): Promise<{ written: true }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedVmid = assertVmid(input.vmid);
    const content = assertContent(String(input.content || ''));

    await this.repository.upsertVmConfig(
      normalizedTenantId,
      normalizedVmid,
      this.encodeVmConfigContent(content),
    );

    return {
      written: true,
    };
  }
}
