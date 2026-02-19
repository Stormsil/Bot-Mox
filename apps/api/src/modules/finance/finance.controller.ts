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
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import type { FinanceListQuery, FinanceService } from './finance.service';

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
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseId(id: string): string {
    const parsed = financeIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): FinanceListQuery {
    const parsed = financeListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseCreateBody(body: unknown): Record<string, unknown> {
    const parsed = financeOperationCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parsePatchBody(body: unknown): Record<string, unknown> {
    const parsed = financeOperationPatchSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get('operations')
  list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown[]; meta: { total: number; page: number; limit: number } } {
    this.ensureAuthHeader(authorization);
    const parsedQuery = this.parseListQuery(query);
    const result = this.financeService.list(parsedQuery);
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
  getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const operation = this.financeService.getById(parsedId);
    if (!operation) {
      throw new NotFoundException('Finance operation not found');
    }
    return {
      success: true,
      data: operation,
    };
  }

  @Post('operations')
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id.trim() : undefined;
    return {
      success: true,
      data: this.financeService.create(parsedBody, explicitId),
    };
  }

  @Patch('operations/:id')
  patch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parsePatchBody(body);
    const updated = this.financeService.patch(parsedId, parsedBody);
    if (!updated) {
      throw new NotFoundException('Finance operation not found');
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Delete('operations/:id')
  remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: { id: string; deleted: boolean } } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const deleted = this.financeService.remove(parsedId);
    if (!deleted) {
      throw new NotFoundException('Finance operation not found');
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
  dailyStats(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.financeService.getDailyStats(),
    };
  }

  @Get('gold-price-history')
  goldPriceHistory(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.financeService.getGoldPriceHistory(),
    };
  }
}
