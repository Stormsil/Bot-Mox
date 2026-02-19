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
  UnauthorizedException,
} from '@nestjs/common';
import type { z } from 'zod';
import type { LicenseService } from './license.service';

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseLeaseBody(body: unknown): z.infer<typeof licenseLeaseRequestSchema> {
    const parsed = licenseLeaseRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseHeartbeatBody(body: unknown): z.infer<typeof licenseHeartbeatSchema> {
    const parsed = licenseHeartbeatSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseRevokeBody(body: unknown): z.infer<typeof licenseRevokeSchema> {
    const parsed = licenseRevokeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Post('lease')
  @HttpCode(201)
  lease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseLeaseBody(body);
    return {
      success: true,
      data: this.licenseService.issueLease(parsedBody),
    };
  }

  @Post('heartbeat')
  heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseHeartbeatBody(body);
    const heartbeat = this.licenseService.heartbeatLease(parsedBody.lease_id);
    if (!heartbeat) {
      throw new NotFoundException('Execution lease not found');
    }
    return {
      success: true,
      data: heartbeat,
    };
  }

  @Post('revoke')
  revoke(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseRevokeBody(body);
    const revoked = this.licenseService.revokeLease(parsedBody.lease_id);
    if (!revoked) {
      throw new NotFoundException('Execution lease not found');
    }
    return {
      success: true,
      data: revoked,
    };
  }
}
