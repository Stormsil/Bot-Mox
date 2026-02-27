import { themeAssetCompleteSchema, themeAssetPresignUploadSchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ZodType, z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { ThemeAssetsService } from './theme-assets.service';

@Controller('theme-assets')
export class ThemeAssetsController {
  constructor(private readonly themeAssetsService: ThemeAssetsService) {}

  private success<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getTenantId(authorization: string | undefined, req: Request): string {
    this.ensureAuthHeader(authorization);
    return getRequestIdentity(req).tenantId;
  }

  private parseWithSchema<TSchema extends ZodType>(
    schema: TSchema,
    input: unknown,
    code: string,
    message: string,
  ): z.output<TSchema> {
    const parsed = schema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code,
        message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private notFoundThemeAsset(): never {
    throw new NotFoundException({
      code: 'THEME_ASSET_NOT_FOUND',
      message: 'Theme asset not found',
    });
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const tenantId = this.getTenantId(authorization, req);
    return this.success(await this.themeAssetsService.listAssets(tenantId));
  }

  @Post('presign-upload')
  @HttpCode(HttpStatus.CREATED)
  async createPresignedUpload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const parsedBody = this.parseWithSchema(
      themeAssetPresignUploadSchema,
      body,
      'THEME_ASSET_INVALID_PRESIGN_BODY',
      'Invalid theme asset presign payload',
    );
    const tenantId = this.getTenantId(authorization, req);
    return this.success(await this.themeAssetsService.createPresignedUpload(parsedBody, tenantId));
  }

  @Post('complete')
  async completeUpload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const parsedBody = this.parseWithSchema(
      themeAssetCompleteSchema,
      body,
      'THEME_ASSET_INVALID_COMPLETE_BODY',
      'Invalid theme asset complete payload',
    );
    const tenantId = this.getTenantId(authorization, req);
    const completed = await this.themeAssetsService.completeUpload(parsedBody, tenantId);
    if (!completed) {
      this.notFoundThemeAsset();
    }
    return this.success(completed);
  }

  @Delete(':id')
  async deleteAsset(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const tenantId = this.getTenantId(authorization, req);
    const deleted = await this.themeAssetsService.deleteAsset(id, tenantId);
    if (!deleted) {
      this.notFoundThemeAsset();
    }
    return this.success(deleted);
  }
}
