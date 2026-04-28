import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { Profile } from './profiles/profile.entity';
import { User } from './users/user.entity';
import { ProfilesModule } from './profiles/profiles.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ApiVersionMiddleware } from './common/middleware/api-version.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Profile, User],
      synchronize: true,
      ssl: { rejectUnauthorized: false },
    }),
    ThrottlerModule.forRoot([
      { name: 'auth', ttl: 60000, limit: 10 },
      { name: 'default', ttl: 60000, limit: 60 },
    ]),
    AuthModule,
    UsersModule,
    ProfilesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');

    consumer
      .apply(ApiVersionMiddleware)
      .forRoutes({ path: 'profiles*', method: RequestMethod.ALL });
  }
}
