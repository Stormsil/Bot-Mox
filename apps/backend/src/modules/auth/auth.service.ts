import { Injectable } from '@nestjs/common';

export interface VerifiedIdentity {
  uid: string;
  email: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  verifyBearerToken(token: string | null | undefined): VerifiedIdentity | null {
    const normalized = String(token || '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!normalized) {
      return null;
    }

    // TODO: replace with Supabase/JWT validation during module cutover.
    return {
      uid: 'nest-shadow-user',
      email: 'nest-shadow-user@local',
      roles: ['user'],
    };
  }
}
