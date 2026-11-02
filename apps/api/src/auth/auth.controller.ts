import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthenticatedUser } from './jwt.strategy.js';

export interface UserProfileResponse {
  id: string;
  email?: string;
  dbRole: string;
  role: string;
  verificationStatus: string;
  authenticatedAt: string;
}

@ApiTags('Authentication & Identity')
@ApiBearerAuth('JWT-auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve verified user identity and role from active JWT session' })
  @ApiResponse({
    status: 200,
    description: 'User profile successfully resolved from verified JWT',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: Invalid, expired, or missing JWT Bearer token',
  })
  getProfile(@CurrentUser() user: AuthenticatedUser): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      dbRole: user.dbRole,
      role: user.role,
      verificationStatus: user.role === 'ADMIN' ? 'VERIFIED' : 'NONE',
      authenticatedAt: new Date().toISOString(),
    };
  }
}
