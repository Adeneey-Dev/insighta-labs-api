import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateGithubUser(profile: {
    github_id: string;
    username: string;
    email: string;
    avatar_url: string;
  }) {
    return this.usersService.createOrUpdate(profile);
  }

  async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };

    const access_token = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '3m',
    });

    const refresh_token = this.jwtService.sign(
      { sub: userId, jti: uuidv7() },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '5m',
      },
    );

    await this.usersService.saveRefreshToken(userId, refresh_token);

    return { access_token, refresh_token };
  }

  async refreshTokens(refresh_token: string) {
    try {
      const payload = this.jwtService.verify(refresh_token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || user.refresh_token !== refresh_token) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Account is inactive');
      }

      return this.generateTokens(user.id, user.role);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersService.clearRefreshToken(userId);
  }
}
