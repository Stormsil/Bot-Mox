import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private async resolveIdentity(authorization: string | undefined): Promise<{
    uid: string;
    email: string;
    roles: string[];
    tenantId: string;
  }> {
    const identity = await this.authService.verifyBearerToken(authorization);
    if (!identity) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
    return identity;
  }

  @Get('verify')
  async verify(@Headers('authorization') authorization: string | undefined): Promise<{
    success: true;
    data: { valid: true };
  }> {
    await this.resolveIdentity(authorization);
    return {
      success: true,
      data: { valid: true },
    };
  }

  @Get('whoami')
  async whoami(@Headers('authorization') authorization: string | undefined): Promise<{
    success: true;
    data: { uid: string; email: string; roles: string[]; tenant_id: string };
  }> {
    const identity = await this.resolveIdentity(authorization);
    return {
      success: true,
      data: {
        uid: identity.uid,
        email: identity.email,
        roles: identity.roles,
        tenant_id: identity.tenantId,
      },
    };
  }
}
