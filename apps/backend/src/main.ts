import 'reflect-metadata';
import type { Server as HttpServer } from 'node:http';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './modules/app.module';
import { InfraGatewayService } from './modules/infra-gateway/infra-gateway.service';
import { attachInfraGatewayUpgradeHandler } from './modules/infra-gateway/infra-gateway.upgrade';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  // Keep OTLP endpoint payload raw for protobuf pass-through proxying.
  app.use('/api/v1/otel/v1/traces', express.raw({ type: '*/*', limit: '20mb' }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );

  const port = Number(process.env.NEST_PORT || process.env.PORT || 3002);
  await app.listen(port);

  const gatewayService = app.get(InfraGatewayService);
  const httpServer = app.getHttpServer() as HttpServer;
  attachInfraGatewayUpgradeHandler({
    server: httpServer,
    gatewayService,
  });
}

void bootstrap();
