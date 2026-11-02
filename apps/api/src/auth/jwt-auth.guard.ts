import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const errorMessage =
        info?.message === 'jwt expired'
          ? 'Authentication token has expired. Please sign in again.'
          : info?.message || 'Access Denied: Valid Supabase JWT Bearer token required.';

      throw err || new UnauthorizedException(errorMessage);
    }
    return user;
  }
}
