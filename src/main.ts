import 'reflect-metadata';
import * as csurf from 'csurf';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Secret for signed cookies (required for csurf with cookie: true)
  const COOKIE_SECRET = process.env.COOKIE_SECRET || 'default-super-secret-change-me';
  app.use(cookieParser(COOKIE_SECRET));

  const frontendUrl =
    process.env.FRONTEND_URL ||
    'https://insighta-labs-web-portal-adeneey-devs-projects.vercel.app';

  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Version',
      'Cookie',
      'X-CSRF-Token', // allow frontend to send CSRF header
    ],
  });

  // CSRF protection using signed cookies
  app.use(csurf({ cookie: { key: '_csrf', signed: true } }));

  // Expose CSRF token to frontend as a non‑HttpOnly cookie
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.csrfToken) {
      const token = req.csrfToken();
      res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,   // must be readable by frontend JavaScript
        secure: true,
        sameSite: 'none',
      });
    }
    next();
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on port ${port}`);
  console.log(`Frontend URL: ${frontendUrl}`);
}
bootstrap();