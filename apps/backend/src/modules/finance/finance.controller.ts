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
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { TenantCrudControllerCoreBase } from '../common/tenant-crud.controller-core-base';
import { type FinanceListQuery, FinanceService } from './finance.service';

const financeIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Finance operation id is required');

@Controller('finance')
export class FinanceController extends TenantCrudControllerCoreBase<
  Record<string, unknown>,
  Record<string, unknown>
> {
  private isFinanceStorageUnavailable(error: unknown): boolean {
    return isPrismaMissingStorageError(error);
  }

  constructor(private readonly financeService: FinanceService) {
    super();
  }

  protected parseId(id: string): string {
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

  protected parseCreateBody(body: unknown): Record<string, unknown> {
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

  protected parseUpdateBody(body: unknown): Record<string, unknown> {
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

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'FINANCE_OPERATION_NOT_FOUND',
      message: 'Finance operation not found',
    };
  }

  protected getEntityById(id: string, tenantId: string) {
    return this.financeService.getById(id, tenantId);
  }

  protected createEntity(
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.financeService.create(body, explicitId, tenantId);
  }

  protected updateEntity(id: string, body: Record<string, unknown>, tenantId: string) {
    return this.financeService.patch(id, body, tenantId);
  }

  protected removeEntity(id: string, tenantId: string) {
    return this.financeService.remove(id, tenantId);
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
    const tenantId = this.getTenantId(req);
    let result: Awaited<ReturnType<FinanceService['list']>>;
    try {
      result = await this.financeService.list(parsedQuery, tenantId);
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      result = {
        items: [],
        total: 0,
        page: parsedQuery.page ?? 1,
        limit: parsedQuery.limit ?? 50,
      };
    }
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
    const tenantId = this.getTenantId(req);
    let operation: Awaited<ReturnType<FinanceService['getById']>>;
    try {
      operation = await this.financeService.getById(parsedId, tenantId);
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      operation = null;
    }
    if (!operation) {
      throw new NotFoundException(this.getNotFoundPayload());
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
    return this.createCore(authorization, body, req);
  }

  @Patch('operations/:id')
  async patch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(authorization, id, body, req);
  }

  @Delete('operations/:id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    return this.removeCore(authorization, id, req) as Promise<{
      success: true;
      data: { id: string; deleted: boolean };
    }>;
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
    const tenantId = this.getTenantId(req);
    try {
      return {
        success: true,
        data: await this.financeService.getDailyStats(tenantId),
      };
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return {
        success: true,
        data: {},
      };
    }
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
    const tenantId = this.getTenantId(req);
    try {
      return {
        success: true,
        data: await this.financeService.getGoldPriceHistory(tenantId),
      };
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return {
        success: true,
        data: {},
      };
    }
  }
}
