import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    // If no user or error occurs (e.g. guest or expired token), return null gracefully
    if (err || !user) {
      return null as any;
    }
    return user;
  }
}
