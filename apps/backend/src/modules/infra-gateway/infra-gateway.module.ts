import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { InfraGatewayMiddleware } from './infra-gateway.middleware';
import { InfraGatewayService } from './infra-gateway.service';

@Module({
  providers: [InfraGatewayService, InfraGatewayMiddleware],
  exports: [InfraGatewayService],
})
export class InfraGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(InfraGatewayMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
