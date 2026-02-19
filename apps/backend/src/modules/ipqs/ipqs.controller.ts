import { ipqsCheckBatchBodySchema, ipqsCheckBodySchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { IpqsService } from './ipqs.service';

@Controller('ipqs')
export class IpqsController {
  constructor(private readonly ipqsService: IpqsService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseCheckBody(body: unknown): import('zod').infer<typeof ipqsCheckBodySchema> {
    const parsed = ipqsCheckBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseBatchBody(body: unknown): import('zod').infer<typeof ipqsCheckBatchBodySchema> {
    const parsed = ipqsCheckBatchBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get('status')
  getStatus(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.ipqsService.getStatus(),
    };
  }

  @Post('check')
  check(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseCheckBody(body);
    return {
      success: true,
      data: this.ipqsService.checkIp(parsed.ip),
    };
  }

  @Post('check-batch')
  checkBatch(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseBatchBody(body);
    return {
      success: true,
      data: this.ipqsService.checkIpBatch(parsed.ips),
    };
  }
}
