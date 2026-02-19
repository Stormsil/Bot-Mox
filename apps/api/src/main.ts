import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );

  const port = Number(process.env.NEST_PORT || 3002);
  await app.listen(port);
}

void bootstrap();
