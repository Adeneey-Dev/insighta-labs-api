import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ProfilesService } from './profiles.service';
import { CsvIngestionService } from './csv-ingestion.service';
import { CacheService } from '../cache/cache.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { memoryStorage } from 'multer';

@Controller('profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfilesController {
  constructor(
    private service: ProfilesService,
    private csvIngestionService: CsvIngestionService,
    private cacheService: CacheService,
  ) {}

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
      return res.status(400).json({
        status: 'error',
        message: 'Missing or empty query parameter',
      });
    }
    try {
      const result = await this.service.search(query.q, query.page, query.limit);
      return res.status(200).json(result);
    } catch {
      return res.status(500).json({ status: 'error', message: 'Server error' });
    }
  }

  @Get('export')
  async exportCsv(@Query() query: Record<string, string>, @Res() res: Response) {
    try {
      const csv = await this.service.exportCsv(query);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="profiles_${timestamp}.csv"`,
      );
      return res.status(200).send(csv);
    } catch {
      return res.status(500).json({ status: 'error', message: 'Server error' });
    }
  }

  @Post()
  @Roles('admin')
  async create(@Body() body: { name: string }, @Res() res: Response) {
    if (!body.name) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Name is required' });
    }
    try {
      const profile = await this.service.createFromName(body.name);
      return res.status(201).json({ status: 'success', data: profile });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Server error' });
    }
  }

  /**
   * POST /api/profiles/import
   *
   * Accepts a multipart CSV file upload (field name: "file").
   * Admin only.
   *
   * Design:
   * - File is stored in memory (not disk) to avoid filesystem issues on Leapcell.
   *   Memory is safe here because Multer enforces the 10MB limit before the
   *   buffer reaches our service. A 500k-row CSV is typically 30–50MB so we
   *   set the limit to 100MB to be safe.
   * - The actual processing (streaming, chunked inserts) happens inside
   *   CsvIngestionService — this controller just handles HTTP concerns.
   * - After import, all profile cache keys are invalidated so reads reflect
   *   the new data immediately.
   *
   * Request: multipart/form-data with field "file" containing the CSV
   * Response: ingestion summary with row counts and skip reasons
   */
  @Post('import')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
      },
      fileFilter: (_req, file, cb) => {
        // Only accept CSV files
        if (
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.toLowerCase().endsWith('.csv')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV files are accepted'), false);
        }
      },
    }),
  )
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded. Send a CSV file in the "file" field.',
      });
    }

    try {
      const result = await this.csvIngestionService.ingestCsv(file.buffer);

      // Invalidate all profile cache entries after a successful import
      // so subsequent reads reflect the newly inserted data
      await this.cacheService.invalidateProfiles();

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        message: `Import failed: ${err.message}`,
      });
    }
  }
}



// import { Controller, Get, Post, Query, Body, Res, UseGuards, Req } from '@nestjs/common';
// import type { Request, Response } from 'express';
// import { ProfilesService } from './profiles.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../common/decorators/roles.decorator';

// @Controller('profiles')
// @UseGuards(JwtAuthGuard, RolesGuard)
// export class ProfilesController {
//   constructor(private service: ProfilesService) {}

//   @Get()
//   async findAll(@Query() query: Record<string, string>, @Res() res: Response) {
//     try {
//       const result = await this.service.findAll(query);
//       return res.status(200).json(result);
//     } catch (e: unknown) {
//       const err = e as { status: string; message: string };
//       if (err?.status === 'error') {
//         return res.status(400).json(err);
//       }
//       return res.status(500).json({ status: 'error', message: 'Server error' });
//     }
//   }

//   @Get('search')
//   async search(@Query() query: Record<string, string>, @Res() res: Response) {
//     if (!query.q || !query.q.trim()) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Missing or empty query parameter',
//       });
//     }
//     try {
//       const result = await this.service.search(query.q, query.page, query.limit);
//       return res.status(200).json(result);
//     } catch {
//       return res.status(500).json({ status: 'error', message: 'Server error' });
//     }
//   }

//   @Get('export')
//   async exportCsv(@Query() query: Record<string, string>, @Res() res: Response) {
//     try {
//       const csv = await this.service.exportCsv(query);
//       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//       res.setHeader('Content-Type', 'text/csv');
//       res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`);
//       return res.status(200).send(csv);
//     } catch {
//       return res.status(500).json({ status: 'error', message: 'Server error' });
//     }
//   }

//   @Post()
//   @Roles('admin')
//   async create(@Body() body: { name: string }, @Res() res: Response) {
//     if (!body.name) {
//       return res.status(400).json({ status: 'error', message: 'Name is required' });
//     }
//     try {
//       const profile = await this.service.createFromName(body.name);
//       return res.status(201).json({ status: 'success', data: profile });
//     } catch {
//       return res.status(500).json({ status: 'error', message: 'Server error' });
//     }
//   }
// }






