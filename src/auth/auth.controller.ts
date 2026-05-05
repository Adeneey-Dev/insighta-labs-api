import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request, Response } from 'express';
import axios from 'axios';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Web portal login — redirects to GitHub
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubLogin() {}

  // Web portal callback — sets HTTP-only cookies
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as any;
      const tokens = await this.authService.generateTokens(
        user.id,
        user.role,
      );

      // Check if CLI request via state
      const state = String(req.query.state || '');
      const isCli = state.startsWith('cli_');

      if (isCli) {
        // Redirect to CLI local server
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
        return res.redirect(
          `http://localhost:9876/callback?tokens=${tokenData}`,
        );
      }

      // Web portal — set HTTP-only cookies
const frontendUrl = process.env.FRONTEND_URL ||
  'https://insighta-labs-web-portal-adeneey-devs-projects.vercel.app';

res.cookie('access_token', tokens.access_token, {
  httpOnly: true,
  secure: true,        // Vercel uses HTTPS, so secure=true
  sameSite: 'none',
  maxAge: 3 * 60 * 1000,   // 3 minutes
});
res.cookie('refresh_token', tokens.refresh_token, {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 5 * 60 * 1000,   // 5 minutes
});

// Redirect to frontend dashboard (no tokens in URL)
return res.redirect(`${frontendUrl}/dashboard`);

    } catch (e: any) {
      console.error('Callback error:', e.message);
      return res.status(500).json({
        status: 'error',
        message: 'Authentication failed: ' + e.message,
      });
    }
  }

  // NEW: CLI exchange endpoint
  // CLI sends: { code, code_verifier, redirect_uri }
  // Backend exchanges with GitHub and returns tokens
  @Post('cli/exchange')
  async cliExchange(
    @Body()
    body: {
      code: string;
      code_verifier: string;
    },
    @Res() res: Response,
  ) {
    try {
      // Exchange code with GitHub directly
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID || '',
        client_secret: process.env.GITHUB_CLIENT_SECRET || '',
        code: body.code,
        redirect_uri: 'http://localhost:9876/callback',
        code_verifier: body.code_verifier,
      });

      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        params.toString(),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const githubAccessToken = tokenResponse.data.access_token;

      if (!githubAccessToken) {
        return res.status(400).json({
          status: 'error',
          message: 'Failed to exchange code with GitHub',
        });
      }

      // Get user info from GitHub
      const userResponse = await axios.get(
        'https://api.github.com/user',
        {
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            Accept: 'application/json',
          },
        },
      );

      const emailResponse = await axios.get(
        'https://api.github.com/user/emails',
        {
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            Accept: 'application/json',
          },
        },
      );

      const githubUser = userResponse.data;
      const emails = emailResponse.data;
      const primaryEmail =
        emails.find((e: any) => e.primary)?.email ||
        emails[0]?.email ||
        '';

      // Create or update user
      const user = await this.authService.validateGithubUser({
        github_id: String(githubUser.id),
        username: githubUser.login,
        email: primaryEmail,
        avatar_url: githubUser.avatar_url,
      });

      // Generate our tokens
      const tokens = await this.authService.generateTokens(
        user.id,
        user.role,
      );

      return res.json({
        status: 'success',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: {
          username: user.username,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
        },
      });
    } catch (e: any) {
      console.error('CLI exchange error:', e.message);
      return res.status(500).json({
        status: 'error',
        message: 'CLI authentication failed: ' + e.message,
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