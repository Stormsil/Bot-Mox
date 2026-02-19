import {
  authHeaderSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
  vmRecordSchema,
  vmResolvePathSchema,
} from './schemas.js';

export const contractRoutesVmRegistry = {
  vmResolve: {
    method: 'GET',
    path: '/api/v1/vm/:uuid/resolve',
    headers: authHeaderSchema,
    pathParams: vmResolvePathSchema,
    responses: {
      200: successEnvelopeSchema(vmRecordSchema),
      400: errorEnvelopeSchema,
      401: errorEnvelopeSchema,
      403: errorEnvelopeSchema,
      404: errorEnvelopeSchema,
      500: errorEnvelopeSchema,
      503: errorEnvelopeSchema,
    },
    summary: 'Resolve VM ownership by VM UUID',
  },
} as const;
