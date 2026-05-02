import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
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
    try {
      const user = req.user as any;
      const tokens = await this.authService.generateTokens(
        user.id,
        user.role,
      );

      // Read state from both the user object and query params
      const state =
        user.oauthState ||
        String(req.query.state || '');

      const isCli = state.startsWith('cli_');

      console.log('=== CALLBACK ===');
      console.log('State:', state);
      console.log('isCli:', isCli);
      console.log('User:', user.username);

      if (isCli) {
        // Redirect back to CLI local server on port 9876
        const tokenPayload = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          user: {
            username: user.username,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url,
          },
        };
        const tokenData = encodeURIComponent(
          JSON.stringify(tokenPayload),
        );
        const cliRedirect = `http://localhost:9876/callback?tokens=${tokenData}`;
        console.log('Redirecting to CLI:', cliRedirect.substring(0, 60));
        return res.redirect(cliRedirect);
      }

      // Web browser flow
      const isProd =
        process.env.NODE_ENV === 'production' ||
        process.env.FRONTEND_URL?.startsWith('https');

      res.cookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/',
      });
      res.cookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/',
      });

      const frontendUrl =
        process.env.FRONTEND_URL ||
        'https://insighta-labs-web-portal-adeneey-devs-projects.vercel.app';

      console.log('Redirecting to web:', frontendUrl + '/dashboard');
      return res.redirect(`${frontendUrl}/dashboard`);
    } catch (e: any) {
      console.error('Callback error:', e.message);
      return res.status(500).json({
        status: 'error',
        message: 'Authentication failed: ' + e.message,
      });
    }
  }

  @Post('refresh')
  async refresh(
    @Body() body: { refresh_token: string },
    @Res() res: Response,
  ) {
    if (!body.refresh_token) {
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token required',
      });
    }
    try {
      const tokens = await this.authService.refreshTokens(
        body.refresh_token,
      );
      return res.json({ status: 'success', ...tokens });
    } catch {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    await this.authService.logout(user.id);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
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