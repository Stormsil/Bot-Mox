import { Module } from '@nestjs/common';
import { ThemeAssetsController } from './theme-assets.controller';
import { ThemeAssetsService } from './theme-assets.service';

@Module({
  controllers: [ThemeAssetsController],
  providers: [ThemeAssetsService],
  exports: [ThemeAssetsService],
})
export class ThemeAssetsModule {}
