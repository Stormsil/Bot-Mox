import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import type { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private resolveIdentity(authorization: string | undefined): {
    uid: string;
    email: string;
    roles: string[];
  } {
    const identity = this.authService.verifyBearerToken(authorization);
    if (!identity) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return identity;
  }

  @Get('verify')
  verify(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: { valid: true };
  } {
    this.resolveIdentity(authorization);
    return {
      success: true,
      data: { valid: true },
    };
  }

  @Get('whoami')
  whoami(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: { uid: string; email: string; roles: string[] };
  } {
    const identity = this.resolveIdentity(authorization);
    return {
      success: true,
      data: identity,
    };
  }
}
