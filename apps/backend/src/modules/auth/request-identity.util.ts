import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { REQUEST_IDENTITY_KEY, type RequestIdentity } from './request-identity';

type RequestWithIdentity = Request & {
  [REQUEST_IDENTITY_KEY]?: RequestIdentity;
};

export function getRequestIdentity(req: Request): RequestIdentity {
  const identity = (req as RequestWithIdentity)[REQUEST_IDENTITY_KEY];
  if (!identity) {
    throw new UnauthorizedException('Missing request identity');
  }
  return identity;
}
