import {
  licenseHeartbeatSchema,
  licenseLeaseRequestSchema,
  licenseRevokeSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { LicenseService } from './license.service';

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseLeaseBody(body: unknown): z.infer<typeof licenseLeaseRequestSchema> {
    const parsed = licenseLeaseRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid license lease request body',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseHeartbeatBody(body: unknown): z.infer<typeof licenseHeartbeatSchema> {
    const parsed = licenseHeartbeatSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid license heartbeat request body',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseRevokeBody(body: unknown): z.infer<typeof licenseRevokeSchema> {
    const parsed = licenseRevokeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid license revoke request body',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Post('lease')
  @HttpCode(201)
  async lease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseLeaseBody(body);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.licenseService.issueLease(parsedBody, {
        tenantId: identity.tenantId,
        userId: identity.userId,
      }),
    };
  }

  @Post('heartbeat')
  async heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseHeartbeatBody(body);
    const identity = getRequestIdentity(req);
    const heartbeat = await this.licenseService.heartbeatLease(
      parsedBody.lease_id,
      identity.tenantId,
    );
    if (!heartbeat) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Execution lease not found',
      });
    }
    return {
      success: true,
      data: heartbeat,
    };
  }

  @Post('revoke')
  async revoke(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseRevokeBody(body);
    const identity = getRequestIdentity(req);
    const revoked = await this.licenseService.revokeLease(parsedBody.lease_id, identity.tenantId);
    if (!revoked) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Execution lease not found',
      });
    }
    return {
      success: true,
      data: revoked,
    };
  }
}
