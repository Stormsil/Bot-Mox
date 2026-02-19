import {
  authHeaderSchema,
  authVerifyResponseSchema,
  authWhoAmIResponseSchema,
  errorEnvelopeSchema,
} from './schemas.js';

export const contractRoutesAuth = {
  authVerify: {
    method: 'GET',
    path: '/api/v1/auth/verify',
    headers: authHeaderSchema,
    responses: {
      200: authVerifyResponseSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Verify auth token',
  },
  authWhoAmI: {
    method: 'GET',
    path: '/api/v1/auth/whoami',
    headers: authHeaderSchema,
    responses: {
      200: authWhoAmIResponseSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
    },
    summary: 'Return current identity',
  },
} as const;
