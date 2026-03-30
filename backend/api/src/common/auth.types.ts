import type { Request } from 'express';
import type { SessionPayload } from '@beauty-finder/types';

export interface AuthenticatedRequest extends Request {
  session?: SessionPayload;
}
