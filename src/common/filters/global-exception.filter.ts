import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { LogsService } from '../../logs/logs.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly logsService: LogsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exceptionResponse;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma database errors
      status = HttpStatus.BAD_REQUEST;
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const targets = (exception.meta as any)?.target;
        const targetStr = Array.isArray(targets) ? targets.join(', ') : targets || 'unknown';
        message = `Unique constraint failed on the fields: ${targetStr}`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record to update not found.';
      } else {
        const lines = exception.message.split('\n');
        message = `Database error: ${lines[lines.length - 1]}`;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log the error
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status}`,
        exception instanceof Error ? exception.stack : exception,
      );

      // Persist error to the database using universal LogsService
      this.logsService.writeExceptionLog({
        product_id: 'SUPER_ADMIN', // Hardcoded for this backend
        company_id: 'SYSTEM',      // Hardcoded system scope
        user_id: (request as any).user?.id || (request as any).user?.global_user_id || undefined,
        error_name: exception instanceof Error ? exception.name : 'UnknownError',
        error_message: String(message),
        stack_trace: exception instanceof Error ? exception.stack : undefined,
        method: request.method,
        path: request.url,
        status_code: status,
        platform: 'nestjs',
        environment: process.env.NODE_ENV || 'development',
        ip_address: request.ip,
        user_agent: request.headers['user-agent'],
        request_body: request.body,
      }).catch(err => {
        this.logger.error(`Failed to write self-exception log: ${err.message}`);
      });
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${status} - Message: ${JSON.stringify(message)}`,
      );
    }

    // Standardized response format
    response.status(status).json({
      status: 'error',
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
