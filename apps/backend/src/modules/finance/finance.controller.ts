import {
  financeListQuerySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
} from '@botmox/api-contract';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { TenantCrudControllerCoreBase } from '../common/tenant-crud.controller-core-base';
import { buildTrimmedIdSchema, parseWithZodOrBadRequest } from '../common/zod-http-parse';
import { type FinanceListQuery, FinanceService } from './finance.service';

const financeIdSchema = buildTrimmedIdSchema('Finance operation id');

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
    return parseWithZodOrBadRequest(financeIdSchema, String(id || ''), {
      code: 'FINANCE_INVALID_ID',
      message: 'Invalid finance operation id',
    });
  }

  private parseListQuery(query: Record<string, unknown>): FinanceListQuery {
    return parseWithZodOrBadRequest(financeListQuerySchema, query ?? {}, {
      code: 'FINANCE_INVALID_LIST_QUERY',
      message: 'Invalid finance list query',
    });
  }

  protected parseCreateBody(body: unknown): Record<string, unknown> {
    return parseWithZodOrBadRequest(financeOperationCreateSchema, body ?? {}, {
      code: 'FINANCE_INVALID_CREATE_BODY',
      message: 'Invalid finance create payload',
    });
  }

  protected parseUpdateBody(body: unknown): Record<string, unknown> {
    return parseWithZodOrBadRequest(financeOperationPatchSchema, body ?? {}, {
      code: 'FINANCE_INVALID_PATCH_BODY',
      message: 'Invalid finance patch payload',
    });
  }

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'FINANCE_OPERATION_NOT_FOUND',
      message: 'Finance operation not found',
    };
  }

  protected getEntityById(id: string, tenantId: string) {
    return this.financeService.getById(id, tenantId).catch((error) => {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return null;
    });
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
    const parsedQuery = this.parseListQuery(query);
    return this.listCore(authorization, req, async (tenantId) => {
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
    });
  }

  @Get('operations/:id')
  async getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.getOneCore(authorization, id, req);
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
