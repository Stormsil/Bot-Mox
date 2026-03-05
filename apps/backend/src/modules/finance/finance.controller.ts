import {
  financeAggregateQuerySchema,
  financeListQuerySchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  financeTimeSeriesQuerySchema,
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
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import {
  createBadRequestValidationPipe,
  ZodSchemaValidationPipe,
} from '../common/http-validation.util';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { buildTrimmedIdSchema } from '../common/zod-http-parse';
import {
  type FinanceAggregateQuery,
  type FinanceListQuery,
  FinanceService,
  type FinanceTimeSeriesQuery,
} from './finance.service';

const financeIdSchema = buildTrimmedIdSchema('Finance operation id');
const financeIdParamPipe = createBadRequestValidationPipe(
  'FINANCE_INVALID_ID',
  'Invalid finance operation id',
);
const financeListQueryPipe = createBadRequestValidationPipe(
  'FINANCE_INVALID_LIST_QUERY',
  'Invalid finance list query',
);
const financeAggregateQueryPipe = createBadRequestValidationPipe(
  'FINANCE_INVALID_AGGREGATE_QUERY',
  'Invalid finance aggregate query',
);
const financeTimeSeriesQueryPipe = createBadRequestValidationPipe(
  'FINANCE_INVALID_TIME_SERIES_QUERY',
  'Invalid finance time-series query',
);
const financeCreateBodyPipe = new ZodSchemaValidationPipe(
  financeOperationCreateSchema,
  'FINANCE_INVALID_CREATE_BODY',
  'Invalid finance create payload',
);
const financePatchBodyPipe = new ZodSchemaValidationPipe(
  financeOperationPatchSchema,
  'FINANCE_INVALID_PATCH_BODY',
  'Invalid finance patch payload',
);

class FinanceOperationIdParamDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  id!: string;
}

class FinanceListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  @MinLength(1)
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  q?: string;
}

class FinanceAggregateQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  from_ts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  to_ts?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  project_id?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  bot_id?: string;
}

class FinanceTimeSeriesQueryDto extends FinanceAggregateQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsIn(['hour', 'day', 'week', 'month'])
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

@Controller('finance')
export class FinanceController {
  private isFinanceStorageUnavailable(error: unknown): boolean {
    return isPrismaMissingStorageError(error);
  }

  constructor(private readonly financeService: FinanceService) {
    // no-op
  }

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  private getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  private buildDeleteResponseData(id: string): { id: string; deleted: boolean } {
    return { id, deleted: true };
  }

  private getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'FINANCE_OPERATION_NOT_FOUND',
      message: 'Finance operation not found',
    };
  }

  private parseWithSchema<T>(
    schema: {
      safeParse: (
        value: unknown,
      ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
    },
    value: unknown,
    code: string,
    message: string,
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code,
        message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private async getOneCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const entity = await this.getEntityById(parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: entity };
  }

  private async listCore<TResponse>(
    authorization: string | undefined,
    req: Request,
    run: (tenantId: string) => Promise<TResponse>,
  ): Promise<TResponse> {
    this.ensureAuthHeader(authorization);
    return run(this.getTenantId(req));
  }

  private async createCore(
    authorization: string | undefined,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const tenantId = this.getTenantId(req);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    return {
      success: true,
      data: await this.createEntity(parsedBody, explicitId, tenantId),
    };
  }

  private async updateCore(
    authorization: string | undefined,
    id: string,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);
    const tenantId = this.getTenantId(req);
    const updated = await this.updateEntity(parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  private async removeCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const deleted = await this.removeEntity(parsedId, tenantId);
    if (!deleted) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: this.buildDeleteResponseData(parsedId) };
  }

  private parseId(id: string): string {
    return this.parseWithSchema(
      financeIdSchema,
      String(id || ''),
      'FINANCE_INVALID_ID',
      'Invalid finance operation id',
    );
  }

  private parseListQuery(query: Record<string, unknown>): FinanceListQuery {
    return this.parseWithSchema(
      financeListQuerySchema,
      query ?? {},
      'FINANCE_INVALID_LIST_QUERY',
      'Invalid finance list query',
    );
  }

  private assertValidDateWindow(fromTs: number | undefined, toTs: number | undefined): void {
    if (fromTs !== undefined && toTs !== undefined && fromTs > toTs) {
      throw new BadRequestException({
        code: 'FINANCE_INVALID_DATE_WINDOW',
        message: 'Invalid finance date window',
        details: {
          from_ts: fromTs,
          to_ts: toTs,
          reason: 'from_ts must be less than or equal to to_ts',
        },
      });
    }
  }

  private parseAggregateQuery(query: Record<string, unknown>): FinanceAggregateQuery {
    const parsed = this.parseWithSchema(
      financeAggregateQuerySchema,
      query ?? {},
      'FINANCE_INVALID_AGGREGATE_QUERY',
      'Invalid finance aggregate query',
    );
    this.assertValidDateWindow(parsed.from_ts, parsed.to_ts);
    return parsed;
  }

  private parseTimeSeriesQuery(query: Record<string, unknown>): FinanceTimeSeriesQuery {
    const parsed = this.parseWithSchema(
      financeTimeSeriesQuerySchema,
      query ?? {},
      'FINANCE_INVALID_TIME_SERIES_QUERY',
      'Invalid finance time-series query',
    );
    this.assertValidDateWindow(parsed.from_ts, parsed.to_ts);
    return parsed;
  }

  private buildEmptySummary(query: FinanceAggregateQuery): {
    income_total: number;
    expense_total: number;
    net_total: number;
    margin_percent: number;
    operation_count: number;
    total_gold_sold: number;
    total_gold_farmed: number;
    average_gold_price: number;
    period: { from_ts?: number; to_ts?: number };
  } {
    return {
      income_total: 0,
      expense_total: 0,
      net_total: 0,
      margin_percent: 0,
      operation_count: 0,
      total_gold_sold: 0,
      total_gold_farmed: 0,
      average_gold_price: 0,
      period: {
        ...(query.from_ts !== undefined ? { from_ts: query.from_ts } : {}),
        ...(query.to_ts !== undefined ? { to_ts: query.to_ts } : {}),
      },
    };
  }

  private parseCreateBody(body: unknown): Record<string, unknown> {
    return this.parseWithSchema(
      financeOperationCreateSchema,
      body ?? {},
      'FINANCE_INVALID_CREATE_BODY',
      'Invalid finance create payload',
    );
  }

  private parseUpdateBody(body: unknown): Record<string, unknown> {
    return this.parseWithSchema(
      financeOperationPatchSchema,
      body ?? {},
      'FINANCE_INVALID_PATCH_BODY',
      'Invalid finance patch payload',
    );
  }

  private getEntityById(id: string, tenantId: string) {
    return this.financeService.getById(id, tenantId).catch((error) => {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return null;
    });
  }

  private createEntity(
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.financeService.create(body, explicitId, tenantId);
  }

  private updateEntity(id: string, body: Record<string, unknown>, tenantId: string) {
    return this.financeService.patch(id, body, tenantId);
  }

  private removeEntity(id: string, tenantId: string) {
    return this.financeService.remove(id, tenantId);
  }

  @Get('operations')
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query(financeListQueryPipe) query: FinanceListQueryDto,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    const parsedQuery = this.parseListQuery(query as Record<string, unknown>);
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
    @Param(financeIdParamPipe) params: FinanceOperationIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.getOneCore(authorization, typeof params === 'string' ? params : params.id, req);
  }

  @Post('operations')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body(financeCreateBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Patch('operations/:id')
  async patch(
    @Headers('authorization') authorization: string | undefined,
    @Param(financeIdParamPipe) params: FinanceOperationIdParamDto | string,
    @Body(financePatchBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      body,
      req,
    );
  }

  @Delete('operations/:id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param(financeIdParamPipe) params: FinanceOperationIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    return this.removeCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      req,
    ) as Promise<{
      success: true;
      data: { id: string; deleted: boolean };
    }>;
  }

  @Get('summary')
  async summary(
    @Headers('authorization') authorization: string | undefined,
    @Query(financeAggregateQueryPipe) query: FinanceAggregateQueryDto,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const tenantId = this.getTenantId(req);
    const parsedQuery = this.parseAggregateQuery(query as Record<string, unknown>);
    try {
      return {
        success: true,
        data: await this.financeService.getSummary(parsedQuery, tenantId),
      };
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return {
        success: true,
        data: this.buildEmptySummary(parsedQuery),
      };
    }
  }

  @Get('breakdown')
  async breakdown(
    @Headers('authorization') authorization: string | undefined,
    @Query(financeAggregateQueryPipe) query: FinanceAggregateQueryDto,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const tenantId = this.getTenantId(req);
    const parsedQuery = this.parseAggregateQuery(query as Record<string, unknown>);
    try {
      return {
        success: true,
        data: await this.financeService.getBreakdown(parsedQuery, tenantId),
      };
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return {
        success: true,
        data: {
          group_by: 'category',
          items: [],
          totals: this.buildEmptySummary(parsedQuery),
          project_performance: {
            source: 'finance_breakdown_aggregate',
            items: [],
          },
        },
      };
    }
  }

  @Get('time-series')
  async timeSeries(
    @Headers('authorization') authorization: string | undefined,
    @Query(financeTimeSeriesQueryPipe) query: FinanceTimeSeriesQueryDto,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const tenantId = this.getTenantId(req);
    const parsedQuery = this.parseTimeSeriesQuery(query as Record<string, unknown>);
    try {
      return {
        success: true,
        data: await this.financeService.getTimeSeries(parsedQuery, tenantId),
      };
    } catch (error) {
      if (!this.isFinanceStorageUnavailable(error)) {
        throw error;
      }
      return {
        success: true,
        data: {
          granularity: parsedQuery.granularity ?? 'day',
          points: [],
          totals: this.buildEmptySummary(parsedQuery),
        },
      };
    }
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
