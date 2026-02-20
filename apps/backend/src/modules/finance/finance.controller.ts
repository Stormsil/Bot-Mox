import {
  financeListQuerySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { type FinanceListQuery, FinanceService } from './finance.service';

const financeIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Finance operation id is required');

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseId(id: string): string {
    const parsed = financeIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'FINANCE_INVALID_ID',
        message: 'Invalid finance operation id',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): FinanceListQuery {
    const parsed = financeListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'FINANCE_INVALID_LIST_QUERY',
        message: 'Invalid finance list query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseCreateBody(body: unknown): Record<string, unknown> {
    const parsed = financeOperationCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'FINANCE_INVALID_CREATE_BODY',
        message: 'Invalid finance create payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parsePatchBody(body: unknown): Record<string, unknown> {
    const parsed = financeOperationPatchSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'FINANCE_INVALID_PATCH_BODY',
        message: 'Invalid finance patch payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get('operations')
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    this.ensureAuthHeader(authorization);
    const parsedQuery = this.parseListQuery(query);
    const identity = getRequestIdentity(req);
    const result = await this.financeService.list(parsedQuery, identity.tenantId);
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get('operations/:id')
  async getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const operation = await this.financeService.getById(parsedId, identity.tenantId);
    if (!operation) {
      throw new NotFoundException({
        code: 'FINANCE_OPERATION_NOT_FOUND',
        message: 'Finance operation not found',
      });
    }
    return {
      success: true,
      data: operation,
    };
  }

  @Post('operations')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id.trim() : undefined;
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.financeService.create(parsedBody, explicitId, identity.tenantId),
    };
  }

  @Patch('operations/:id')
  async patch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parsePatchBody(body);
    const identity = getRequestIdentity(req);
    const updated = await this.financeService.patch(parsedId, parsedBody, identity.tenantId);
    if (!updated) {
      throw new NotFoundException({
        code: 'FINANCE_OPERATION_NOT_FOUND',
        message: 'Finance operation not found',
      });
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Delete('operations/:id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const deleted = await this.financeService.remove(parsedId, identity.tenantId);
    if (!deleted) {
      throw new NotFoundException({
        code: 'FINANCE_OPERATION_NOT_FOUND',
        message: 'Finance operation not found',
      });
    }
    return {
      success: true,
      data: {
        id: parsedId,
        deleted: true,
      },
    };
  }

  @Get('daily-stats')
  async dailyStats(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.financeService.getDailyStats(identity.tenantId),
    };
  }

  @Get('gold-price-history')
  async goldPriceHistory(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.financeService.getGoldPriceHistory(identity.tenantId),
    };
  }
}
