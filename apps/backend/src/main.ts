import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { AgentsService } from './modules/agents/agents.service';
import { attachAgentsWsServer } from './modules/agents/agents-ws-server';
import { AppModule } from './modules/app.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthService } from './modules/auth/auth.service';
import { HttpErrorEnvelopeFilter } from './modules/common/http-error-envelope.filter';
import { InfraGatewayService } from './modules/infra-gateway/infra-gateway.service';
import { attachInfraGatewayUpgradeHandler } from './modules/infra-gateway/infra-gateway.upgrade';
import { VmOpsService } from './modules/vm-ops/vm-ops.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  // Keep OTLP endpoint payload raw for protobuf pass-through proxying.
  app.use('/api/v1/otel/v1/traces', express.raw({ type: '*/*', limit: '20mb' }));

  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const traceId = String(req.headers['x-trace-id'] || '').trim() || randomUUID();
    const correlationId = String(req.headers['x-correlation-id'] || '').trim() || randomUUID();
    const requestId = String(req.headers['x-request-id'] || '').trim() || randomUUID();

    req.headers['x-trace-id'] = traceId;
    req.headers['x-correlation-id'] = correlationId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalGuards(app.get(AuthGuard));
  app.useGlobalFilters(new HttpErrorEnvelopeFilter());

  const port = Number(process.env.NEST_PORT || process.env.PORT || 3002);
  await app.listen(port);

  const gatewayService = app.get(InfraGatewayService);
  const authService = app.get(AuthService);
  const vmOpsService = app.get(VmOpsService);
  const agentsService = app.get(AgentsService);
  const httpServer = app.getHttpServer() as HttpServer;
  attachInfraGatewayUpgradeHandler({
    server: httpServer,
    gatewayService,
  });
  attachAgentsWsServer({
    server: httpServer,
    authService,
    vmOpsService,
    agentsService,
  });
}

void bootstrap();
