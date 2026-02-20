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
import { getRequestIdentity } from '../auth/request-identity.util';
import { ThemeAssetsService } from './theme-assets.service';

@Controller('theme-assets')
export class ThemeAssetsController {
  constructor(private readonly themeAssetsService: ThemeAssetsService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parsePresignBody(
    body: unknown,
  ): import('zod').infer<typeof themeAssetPresignUploadSchema> {
    const parsed = themeAssetPresignUploadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'THEME_ASSET_INVALID_PRESIGN_BODY',
        message: 'Invalid theme asset presign payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseCompleteBody(body: unknown): import('zod').infer<typeof themeAssetCompleteSchema> {
    const parsed = themeAssetCompleteSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'THEME_ASSET_INVALID_COMPLETE_BODY',
        message: 'Invalid theme asset complete payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get()
  async list(
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
      data: await this.themeAssetsService.listAssets(identity.tenantId),
    };
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
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parsePresignBody(body);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.themeAssetsService.createPresignedUpload(parsedBody, identity.tenantId),
    };
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
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCompleteBody(body);
    const identity = getRequestIdentity(req);
    const completed = await this.themeAssetsService.completeUpload(parsedBody, identity.tenantId);
    if (!completed) {
      throw new NotFoundException({
        code: 'THEME_ASSET_NOT_FOUND',
        message: 'Theme asset not found',
      });
    }
    return {
      success: true,
      data: completed,
    };
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
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    const deleted = await this.themeAssetsService.deleteAsset(id, identity.tenantId);
    if (!deleted) {
      throw new NotFoundException({
        code: 'THEME_ASSET_NOT_FOUND',
        message: 'Theme asset not found',
      });
    }
    return {
      success: true,
      data: deleted,
    };
  }
}
