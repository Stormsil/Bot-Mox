import type { JWTPayload } from 'jose';
import type { AccessProfile } from './auth.service';

export interface RequestIdentity {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
  access?: AccessProfile;
  tokenId?: string;
  raw: JWTPayload;
}

export const REQUEST_IDENTITY_KEY = 'requestIdentity';
