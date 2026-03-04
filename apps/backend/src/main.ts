import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { AgentsService } from './modules/agents/agents.service';
import { attachAgentsWsServer } from './modules/agents/agents-ws-server';
import { AppModule } from './modules/app.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthService } from './modules/auth/auth.service';
import { runWithRequestContext } from './modules/auth/request-context';
import { HttpErrorEnvelopeFilter } from './modules/common/http-error-envelope.filter';
import {
  extractRequestOrigin,
  isAdminOriginProtectedPath,
  normalizeOrigin,
  parseAllowedOrigins,
} from './modules/common/origin-policy';
import { InfraGatewayService } from './modules/infra-gateway/infra-gateway.service';
import { attachInfraGatewayUpgradeHandler } from './modules/infra-gateway/infra-gateway.upgrade';
import { RuntimeMetricsService } from './modules/observability/runtime-metrics.service';
import { VmOpsService } from './modules/vm-ops/vm-ops.service';

function isTruthy(value: string | undefined, fallback = false): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const publicCorsOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN, [
    'http://localhost',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://app.localhost',
  ]);
  const adminCorsOrigins = parseAllowedOrigins(process.env.ADMIN_CORS_ORIGIN, [
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://admin.localhost',
  ]);
  const allCorsOrigins = new Set<string>([...publicCorsOrigins, ...adminCorsOrigins]);
  const enforceAdminOrigin = isTruthy(process.env.ADMIN_ORIGIN_ENFORCEMENT, true);
  const nodeEnv = String(process.env.NODE_ENV || 'development')
    .trim()
    .toLowerCase();
  const enforceAdminOriginStrict = isTruthy(
    process.env.ADMIN_ORIGIN_STRICT,
    nodeEnv === 'production',
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      if (normalized && allCorsOrigins.has(normalized)) {
        callback(null, true);
        return;
      }

      // Unknown origins should not crash the request pipeline.
      // We disable CORS headers for them and let downstream auth/origin guards
      // return explicit policy errors (e.g. ADMIN_ORIGIN_FORBIDDEN).
      callback(null, false);
    },
    credentials: true,
  });

  // Keep OTLP endpoint payload raw for protobuf pass-through proxying.
  app.use('/api/v1/otel/v1/traces', express.raw({ type: '*/*', limit: '20mb' }));
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    runWithRequestContext(() => {
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
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!enforceAdminOrigin) {
      next();
      return;
    }

    if (!isAdminOriginProtectedPath(String(req.originalUrl || req.url || ''))) {
      next();
      return;
    }

    const requestOrigin = extractRequestOrigin(req.headers);
    if (!requestOrigin) {
      if (enforceAdminOriginStrict) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ADMIN_ORIGIN_REQUIRED',
            message: 'Origin or Referer header is required for admin endpoints',
          },
        });
        return;
      }

      next();
      return;
    }

    if (!adminCorsOrigins.has(requestOrigin)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ORIGIN_FORBIDDEN',
          message: 'Admin endpoint is not accessible from this origin',
          details: {
            request_origin: requestOrigin,
          },
        },
      });
      return;
    }

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
  const runtimeMetricsService = app.get(RuntimeMetricsService);
  app.useGlobalFilters(new HttpErrorEnvelopeFilter(runtimeMetricsService));

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
    runtimeMetricsService,
  });
}

void bootstrap();
