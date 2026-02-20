import { wowNamesQuerySchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { WowNamesService } from './wow-names.service';

@Controller('wow-names')
export class WowNamesController {
  constructor(private readonly wowNamesService: WowNamesService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseQuery(
    query: Record<string, unknown>,
  ): import('zod').infer<typeof wowNamesQuerySchema> {
    const parsed = wowNamesQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WOW_NAMES_INVALID_QUERY',
        message: 'Invalid wow names query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get()
  get(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseQuery(query);
    const payload = this.wowNamesService.getWowNames(parsed);

    if (payload.count > 0) {
      return {
        success: true,
        data: {
          names: payload.names,
        },
      };
    }

    return {
      success: true,
      data: {
        random: payload.random,
        names: payload.names,
        batches: payload.batches,
        source: payload.source,
      },
    };
  }
}
