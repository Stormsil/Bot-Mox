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
  UnauthorizedException,
} from '@nestjs/common';
import type { ThemeAssetsService } from './theme-assets.service';

@Controller('theme-assets')
export class ThemeAssetsController {
  constructor(private readonly themeAssetsService: ThemeAssetsService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parsePresignBody(
    body: unknown,
  ): import('zod').infer<typeof themeAssetPresignUploadSchema> {
    const parsed = themeAssetPresignUploadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseCompleteBody(body: unknown): import('zod').infer<typeof themeAssetCompleteSchema> {
    const parsed = themeAssetCompleteSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get()
  list(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.themeAssetsService.listAssets(),
    };
  }

  @Post('presign-upload')
  @HttpCode(HttpStatus.CREATED)
  createPresignedUpload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parsePresignBody(body);
    return {
      success: true,
      data: this.themeAssetsService.createPresignedUpload(parsedBody),
    };
  }

  @Post('complete')
  completeUpload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCompleteBody(body);
    const completed = this.themeAssetsService.completeUpload(parsedBody);
    if (!completed) {
      throw new NotFoundException('Theme asset not found');
    }
    return {
      success: true,
      data: completed,
    };
  }

  @Delete(':id')
  deleteAsset(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    const deleted = this.themeAssetsService.deleteAsset(id);
    if (!deleted) {
      throw new NotFoundException('Theme asset not found');
    }
    return {
      success: true,
      data: deleted,
    };
  }
}
