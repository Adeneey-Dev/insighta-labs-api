import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from './auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      scope: ['user:email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ) {
    try {
      const user = await this.authService.validateGithubUser({
        github_id: String(profile.id),
        username: profile.username,
        email: profile.emails?.[0]?.value || '',
        avatar_url: profile.photos?.[0]?.value || '',
      });
      // Attach state to user object so controller can read it
      (user as any).oauthState = req.query.state || '';
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
}