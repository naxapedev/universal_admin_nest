import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLogsService } from './activity-logs.service';
import { Request } from 'express';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    
    // Only log modifying requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const className = context.getClass().name; // e.g. UsersController
      const methodName = context.getHandler().name; // e.g. create
      
      const action = `${request.method} ${request.route?.path || request.path}`;
      const entity_type = className.replace('Controller', '');
      const actor_id = (request as any).user?.id || (request as any).user?.global_user_id || undefined;

      // Extract entity_id from params if it exists (like /users/:id)
      const rawId = request.params?.id;
      const entity_id = Array.isArray(rawId) ? rawId[0] : rawId;

      // Remove sensitive data from body before logging
      const safeBody = this.sanitiseBody(request.body);

      // Fire and forget, don't await because it shouldn't block the request response
      // We use tap so it fires *after* the request is handled successfully.
      return next.handle().pipe(
        tap((data) => {
          console.log(`[Activity Log] SUCCESS: ${action} by Actor: ${actor_id || 'unknown'} | Payload:`, safeBody);
          this.activityLogsService.writeActivityLog({
            actor_id,
            action,
            entity_type,
            entity_id,
            details: {
              methodName,
              body: safeBody,
              query: request.query,
            },
            ip_address: request.ip,
            user_agent: request.headers['user-agent'],
          }).catch(console.error);
        }),
      );
    }

    return next.handle();
  }

  private sanitiseBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveKeys = ['password', 'password_hash', 'token', 'access_token', 'refresh_token', 'secret', 'passwordHash', 'confirmPassword'];
    const sanitised = { ...body };
    
    for (const key of Object.keys(sanitised)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitised[key] = '[REDACTED]';
      } else if (typeof sanitised[key] === 'object' && sanitised[key] !== null) {
        sanitised[key] = this.sanitiseBody(sanitised[key]);
      }
    }
    return sanitised;
  }
}
