import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

@Catch(Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter
  implements ExceptionFilter<Prisma.PrismaClientInitializationError>
{
  catch(exception: Prisma.PrismaClientInitializationError, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message:
        'Database connection is unavailable. Check DATABASE_URL or start the local Postgres service before retrying.',
      code: exception.errorCode ?? 'DATABASE_UNAVAILABLE',
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
