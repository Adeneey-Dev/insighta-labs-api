import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async findByGithubId(github_id: string): Promise<User | null> {
    return this.repo.findOne({ where: { github_id } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async createOrUpdate(profile: {
    github_id: string;
    username: string;
    email: string;
    avatar_url: string;
  }): Promise<User> {
    let user = await this.findByGithubId(profile.github_id);
    if (!user) {
      user = this.repo.create({
        github_id: profile.github_id,
        username: profile.username,
        email: profile.email,
        avatar_url: profile.avatar_url,
        role: 'analyst',
        is_active: true,
      });
    } else {
      user.username = profile.username;
      user.email = profile.email;
      user.avatar_url = profile.avatar_url;
    }
    user.last_login_at = new Date();
    return this.repo.save(user);
  }

  async saveRefreshToken(userId: string, token: string): Promise<void> {
    await this.repo.update(userId, { refresh_token: token });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.repo.update(userId, { refresh_token: null });
  }
}
