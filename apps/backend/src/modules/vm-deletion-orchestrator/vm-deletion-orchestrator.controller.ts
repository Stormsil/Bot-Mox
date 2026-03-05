import { vmDeletionEvaluateBodySchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import type { VmDeletionPolicy } from '../infra/infra.types';
import { VmDeletionOrchestratorService } from './vm-deletion-orchestrator.service';

@Controller('vms')
export class VmDeletionOrchestratorController {
  constructor(private readonly vmDeletionOrchestratorService: VmDeletionOrchestratorService) {}

  private ensureAuthorizationHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private resolveTenantId(authorization: string | undefined, req: Request): string {
    this.ensureAuthorizationHeader(authorization);
    return getRequestIdentity(req).tenantId;
  }

  private parsePolicyFromRawBody(body: unknown): Partial<VmDeletionPolicy> | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }
    const rawPolicy = (body as { policy?: unknown }).policy;
    if (!rawPolicy || typeof rawPolicy !== 'object') {
      return undefined;
    }

    const policyObject = rawPolicy as Record<string, unknown>;
    const out: Partial<VmDeletionPolicy> = {};
    if (typeof policyObject.allowBanned === 'boolean') {
      out.allowBanned = policyObject.allowBanned;
    }
    if (typeof policyObject.allowPrepareNoResources === 'boolean') {
      out.allowPrepareNoResources = policyObject.allowPrepareNoResources;
    }
    if (typeof policyObject.allowOrphan === 'boolean') {
      out.allowOrphan = policyObject.allowOrphan;
    }
    return out;
  }

  @Post('evaluate-deletion')
  async evaluateDeletion(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const parsed = vmDeletionEvaluateBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VM_DELETE_EVALUATE_INVALID_BODY',
        message: 'Invalid VM deletion evaluate payload',
        details: parsed.error.flatten(),
      });
    }

    const data = await this.vmDeletionOrchestratorService.evaluateVmDeletion(tenantId, {
      items: parsed.data.items,
      policy: this.parsePolicyFromRawBody(body),
    });

    return {
      success: true,
      data,
    };
  }
}
