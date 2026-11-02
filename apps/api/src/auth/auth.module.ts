import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RoleSecurityService } from './role-security.service.js';
import { RoleAssignmentSecurityGuard } from './role-assignment.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController],
  providers: [
    RoleSecurityService,
    RoleAssignmentSecurityGuard,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [
    RoleSecurityService,
    RoleAssignmentSecurityGuard,
    JwtStrategy,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
