import {
  authHeaderSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
  wowNamesQuerySchema,
  wowNamesResponseSchema,
} from './schemas.js';

export const contractRoutesWowNames = {
  wowNamesGet: {
    method: 'GET',
    path: '/api/v1/wow-names',
    headers: authHeaderSchema,
    query: wowNamesQuerySchema,
    responses: {
      200: successEnvelopeSchema(wowNamesResponseSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
    },
    summary: 'Get generated WoW names',
  },
} as const;
