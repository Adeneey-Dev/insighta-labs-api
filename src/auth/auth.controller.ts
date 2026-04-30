import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubLogin() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    const tokens = await this.authService.generateTokens(user.id, user.role);

    const isCli =
      req.query.cli === 'true' || req.query.state?.toString().includes('cli');

    if (isCli) {
      // Redirect back to CLI local server with tokens
      const tokenData = encodeURIComponent(
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          user: {
            username: user.username,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url,
          },
        }),
      );
      return res.redirect(`http://localhost:9876/callback?tokens=${tokenData}`);
    }

    // Web browser flow — set HTTP-only cookies
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }, @Res() res: Response) {
    if (!body.refresh_token) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Refresh token required' });
    }
    try {
      const tokens = await this.authService.refreshTokens(body.refresh_token);
      return res.json({ status: 'success', ...tokens });
    } catch {
      return res
        .status(401)
        .json({ status: 'error', message: 'Invalid or expired refresh token' });
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    await this.authService.logout(user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.json({ status: 'success', message: 'Logged out successfully' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const user = req.user as any;
    return {
      status: 'success',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    };
  }
}
