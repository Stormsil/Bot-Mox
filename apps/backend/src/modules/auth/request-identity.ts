import type { JWTPayload } from 'jose';

export interface RequestIdentity {
  userId: string;
  email: string;
  roles: string[];
  tenantId: string;
  tokenId?: string;
  raw: JWTPayload;
}

export const REQUEST_IDENTITY_KEY = 'requestIdentity';
