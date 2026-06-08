import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: Error | null, user: T, info: Error | null): T {
    if (err || !user) {
      throw new UnauthorizedException(info?.message ?? 'Unauthorized');
    }
    return user;
  }
}
