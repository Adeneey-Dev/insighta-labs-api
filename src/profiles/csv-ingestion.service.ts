import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './profile.entity';
import { v7 as uuidv7 } from 'uuid';
import { parse } from 'csv-parse';
import { Readable } from 'stream';

/**
 * Expected CSV column order (case-insensitive headers):
 * name, gender, gender_probability, age, age_group,
 * country_id, country_name, country_probability
 *
 * The id and created_at columns are generated server-side and must NOT be in the CSV.
 */

const VALID_GENDERS = new Set(['male', 'female']);
const VALID_AGE_GROUPS = new Set(['child', 'teenager', 'adult', 'senior']);

// Number of rows we insert in a single DB transaction.
// Large enough to be efficient, small enough to not lock the table for long.
const CHUNK_SIZE = 500;

export interface IngestionResult {
  status: 'success';
  total_rows: number;
  inserted: number;
  skipped: number;
  reasons: {
    duplicate_name: number;
    invalid_age: number;
    invalid_gender: number;
    invalid_age_group: number;
    missing_fields: number;
    malformed_row: number;
  };
}

interface ParsedRow {
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
}

@Injectable()
export class CsvIngestionService {
  private readonly logger = new Logger(CsvIngestionService.name);

  constructor(
    @InjectRepository(Profile)
    private repo: Repository<Profile>,
  ) {}

  /**
   * Main entry point. Accepts a file buffer, streams it through the CSV parser,
   * validates each row, and inserts in chunks.
   *
   * Design decisions:
   * - Streaming: we never load the entire file into memory. The parser emits rows
   *   one at a time and we buffer them into chunks of CHUNK_SIZE before inserting.
   * - No rollback on partial failure: rows already inserted stay. A bad row is
   *   skipped with a reason recorded, not a reason to fail everything.
   * - Duplicate detection: we check names against existing records using a
   *   bulk lookup per chunk rather than one query per row.
   * - Concurrent uploads: each upload runs independently. TypeORM's connection
   *   pool handles concurrent DB access safely.
   */
  async ingestCsv(fileBuffer: Buffer): Promise<IngestionResult> {
    const result: IngestionResult = {
      status: 'success',
      total_rows: 0,
      inserted: 0,
      skipped: 0,
      reasons: {
        duplicate_name: 0,
        invalid_age: 0,
        invalid_gender: 0,
        invalid_age_group: 0,
        missing_fields: 0,
        malformed_row: 0,
      },
    };

    // Buffer of validated rows waiting to be inserted
    const chunk: ParsedRow[] = [];

    return new Promise((resolve, reject) => {
      const stream = Readable.from(fileBuffer);

      const parser = stream.pipe(
        parse({
          columns: true, // use first row as header names
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true, // don't throw on wrong column count — we validate ourselves
          encoding: 'utf8',
          bom: true, // handle BOM characters Excel sometimes adds
        }),
      );

      parser.on('data', async (rawRow: Record<string, string>) => {
        result.total_rows++;

        const validation = this.validateRow(rawRow, result);
        if (!validation) return; // skipped — reason already recorded

        chunk.push(validation);

        // When we have a full chunk, pause the stream and flush to DB
        if (chunk.length >= CHUNK_SIZE) {
          parser.pause();
          const rows = chunk.splice(0, CHUNK_SIZE);
          try {
            const { inserted, duplicates } = await this.insertChunk(rows);
            result.inserted += inserted;
            result.skipped += duplicates;
            result.reasons.duplicate_name += duplicates;
          } catch (err: any) {
            this.logger.error(`Chunk insert error: ${err.message}`);
            // Don't reject — skip the chunk and continue
            result.skipped += rows.length;
          }
          parser.resume();
        }
      });

      parser.on('skip', () => {
        // csv-parse emits 'skip' for malformed rows when relax_column_count is on
        result.total_rows++;
        result.skipped++;
        result.reasons.malformed_row++;
      });

      parser.on('error', (err) => {
        this.logger.error(`CSV parse error: ${err.message}`);
        // Don't reject the whole upload for a parse error — resolve with what we have
        resolve(result);
      });

      parser.on('end', async () => {
        // Flush any remaining rows that didn't fill a full chunk
        if (chunk.length > 0) {
          try {
            const { inserted, duplicates } = await this.insertChunk(chunk);
            result.inserted += inserted;
            result.skipped += duplicates;
            result.reasons.duplicate_name += duplicates;
          } catch (err: any) {
            this.logger.error(`Final chunk insert error: ${err.message}`);
            result.skipped += chunk.length;
          }
        }

        this.logger.log(
          `CSV ingestion complete — total: ${result.total_rows}, ` +
            `inserted: ${result.inserted}, skipped: ${result.skipped}`,
        );
        resolve(result);
      });
    });
  }

  /**
   * Validates a single raw CSV row.
   * Returns a typed ParsedRow if valid, or null if the row should be skipped.
   * Records the skip reason in the result object.
   */
  private validateRow(
    raw: Record<string, string>,
    result: IngestionResult,
  ): ParsedRow | null {
    // Normalize header names (handle case differences and BOM)
    const row: Record<string, string> = {};
    for (const key of Object.keys(raw)) {
      row[
        key
          .toLowerCase()
          .trim()
          .replace(/^\uFEFF/, '')
      ] = raw[key];
    }

    // Required fields check
    const requiredFields = [
      'name',
      'gender',
      'gender_probability',
      'age',
      'age_group',
      'country_id',
      'country_name',
      'country_probability',
    ];

    for (const field of requiredFields) {
      if (!row[field] || row[field].trim() === '') {
        result.skipped++;
        result.reasons.missing_fields++;
        return null;
      }
    }

    // Name must be a non-empty string
    const name = row['name'].trim();
    if (!name) {
      result.skipped++;
      result.reasons.missing_fields++;
      return null;
    }

    // Gender validation
    const gender = row['gender'].toLowerCase().trim();
    if (!VALID_GENDERS.has(gender)) {
      result.skipped++;
      result.reasons.invalid_gender++;
      return null;
    }

    // Gender probability — float between 0 and 1
    const gender_probability = parseFloat(row['gender_probability']);
    if (
      isNaN(gender_probability) ||
      gender_probability < 0 ||
      gender_probability > 1
    ) {
      result.skipped++;
      result.reasons.malformed_row++;
      return null;
    }

    // Age — positive integer
    const age = parseInt(row['age']);
    if (isNaN(age) || age < 0 || age > 150) {
      result.skipped++;
      result.reasons.invalid_age++;
      return null;
    }

    // Age group validation
    const age_group = row['age_group'].toLowerCase().trim();
    if (!VALID_AGE_GROUPS.has(age_group)) {
      result.skipped++;
      result.reasons.invalid_age_group++;
      return null;
    }

    // Country ID — 2-letter ISO code
    const country_id = row['country_id'].toUpperCase().trim();
    if (!/^[A-Z]{2}$/.test(country_id)) {
      result.skipped++;
      result.reasons.malformed_row++;
      return null;
    }

    // Country name
    const country_name = row['country_name'].trim();
    if (!country_name) {
      result.skipped++;
      result.reasons.missing_fields++;
      return null;
    }

    // Country probability — float between 0 and 1
    const country_probability = parseFloat(row['country_probability']);
    if (
      isNaN(country_probability) ||
      country_probability < 0 ||
      country_probability > 1
    ) {
      result.skipped++;
      result.reasons.malformed_row++;
      return null;
    }

    return {
      name,
      gender,
      gender_probability,
      age,
      age_group,
      country_id,
      country_name,
      country_probability,
    };
  }

  /**
   * Inserts a chunk of validated rows into the database.
   *
   * Duplicate detection strategy:
   * - We extract all names from the chunk
   * - One query fetches all existing names from DB that overlap with the chunk
   * - We filter out duplicates before inserting
   * - This means O(1) DB queries per chunk regardless of chunk size,
   *   not O(N) queries (one per row)
   */
  private async insertChunk(
    rows: ParsedRow[],
  ): Promise<{ inserted: number; duplicates: number }> {
    if (rows.length === 0) return { inserted: 0, duplicates: 0 };

    const names = rows.map((r) => r.name);

    // Fetch existing names in one query
    const existing = await this.repo
      .createQueryBuilder('p')
      .select('p.name')
      .where('p.name IN (:...names)', { names })
      .getMany();

    const existingNames = new Set(existing.map((p) => p.name));

    const toInsert = rows.filter((r) => !existingNames.has(r.name));
    const duplicates = rows.length - toInsert.length;

    if (toInsert.length === 0) {
      return { inserted: 0, duplicates };
    }

    // Build profile entities
    const profiles = toInsert.map((r) =>
      this.repo.create({
        id: uuidv7(),
        name: r.name,
        gender: r.gender,
        gender_probability: r.gender_probability,
        age: r.age,
        age_group: r.age_group,
        country_id: r.country_id,
        country_name: r.country_name,
        country_probability: r.country_probability,
      }),
    );

    // Bulk insert — one INSERT statement for the whole chunk
    // ON CONFLICT DO NOTHING handles any race conditions between concurrent uploads
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Profile)
      .values(profiles)
      .orIgnore() // equivalent to ON CONFLICT DO NOTHING
      .execute();

    return { inserted: toInsert.length, duplicates };
  }
}
