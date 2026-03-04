import { themeAssetCompleteSchema, themeAssetPresignUploadSchema } from '@botmox/api-contract';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import { ZodSchemaValidationPipe } from '../common/http-validation.util';
import { ThemeAssetsService } from './theme-assets.service';

const themeAssetPresignBodyPipe = new ZodSchemaValidationPipe(
  themeAssetPresignUploadSchema,
  'THEME_ASSET_INVALID_PRESIGN_BODY',
  'Invalid theme asset presign payload',
);
const themeAssetCompleteBodyPipe = new ZodSchemaValidationPipe(
  themeAssetCompleteSchema,
  'THEME_ASSET_INVALID_COMPLETE_BODY',
  'Invalid theme asset complete payload',
);

@Controller('theme-assets')
export class ThemeAssetsController {
  constructor(private readonly themeAssetsService: ThemeAssetsService) {}

  private success<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }

  private getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  private notFoundThemeAsset(): never {
    throw new NotFoundException({
      code: 'THEME_ASSET_NOT_FOUND',
      message: 'Theme asset not found',
    });
  }

  @Get()
  async list(@Req() req: Request): Promise<{
    success: true;
    data: unknown;
  }> {
    const tenantId = this.getTenantId(req);
    return this.success(await this.themeAssetsService.listAssets(tenantId));
  }

  @Post('presign-upload')
  @HttpCode(HttpStatus.CREATED)
  async createPresignedUpload(
    @Body(themeAssetPresignBodyPipe) body: ReturnType<typeof themeAssetPresignUploadSchema.parse>,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const tenantId = this.getTenantId(req);
    return this.success(await this.themeAssetsService.createPresignedUpload(body, tenantId));
  }

  @Post('complete')
  async completeUpload(
    @Body(themeAssetCompleteBodyPipe) body: ReturnType<typeof themeAssetCompleteSchema.parse>,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const tenantId = this.getTenantId(req);
    const completed = await this.themeAssetsService.completeUpload(body, tenantId);
    if (!completed) {
      this.notFoundThemeAsset();
    }
    return this.success(completed);
  }

  @Delete(':id')
  async deleteAsset(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    const tenantId = this.getTenantId(req);
    const deleted = await this.themeAssetsService.deleteAsset(id, tenantId);
    if (!deleted) {
      this.notFoundThemeAsset();
    }
    return this.success(deleted);
  }
}
