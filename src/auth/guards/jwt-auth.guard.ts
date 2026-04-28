import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized',
      });
    }
    if (!user.is_active) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account is inactive',
      });
    }
    return user;
  }
}
