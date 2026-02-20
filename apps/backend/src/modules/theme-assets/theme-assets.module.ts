import { Module } from '@nestjs/common';
import { ThemeAssetsController } from './theme-assets.controller';
import { ThemeAssetsRepository } from './theme-assets.repository';
import { ThemeAssetsService } from './theme-assets.service';

@Module({
  controllers: [ThemeAssetsController],
  providers: [ThemeAssetsRepository, ThemeAssetsService],
  exports: [ThemeAssetsService],
})
export class ThemeAssetsModule {}
