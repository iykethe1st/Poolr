import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TermiiService } from './termii.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Secrets are provided per-call in AuthService; JwtModule just makes JwtService injectable
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TermiiService],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
