import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private service: ProfilesService) {}

  @Get()
  async findAll(@Query() query: Record<string, string>, @Res() res: Response) {
    try {
      const result = await this.service.findAll(query);
      return res.status(200).json(result);
    } catch (e: unknown) {
      const err = e as { status: string; message: string };
      if (err?.status === 'error') {
        return res.status(400).json(err);
      }
      return res.status(500).json({ status: 'error', message: 'Server error' });
    }
  }

  @Get('search')
  async search(@Query() query: Record<string, string>, @Res() res: Response) {
    if (!query.q || !query.q.trim()) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Missing or empty query parameter' });
    }
    try {
      const result = await this.service.search(
        query.q,
        query.page,
        query.limit,
      );
      return res.status(200).json(result);
    } catch (e) {
      return res.status(500).json({ status: 'error', message: 'Server error' });
    }
  }
}
