import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '../profiles/profile.entity';
import { v7 as uuidv7 } from 'uuid';
import * as data from './seed-data.json';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SeedService');

  constructor(
    @InjectRepository(Profile)
    private repo: Repository<Profile>,
  ) {}

  onApplicationBootstrap() {
    this.seed().catch((err) => this.logger.error('Seed failed', err));
  }

  async seed() {
    const records: any[] = (data as any).profiles;
    let inserted = 0;
    let skipped = 0;

    for (const r of records) {
      try {
        const exists = await this.repo.findOne({ where: { name: r.name } });
        if (exists) {
          skipped++;
          continue;
        }

        await this.repo.save(
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
        inserted++;
      } catch (e) {
        skipped++;
      }
    }

    this.logger.log(`Seed done — inserted: ${inserted}, skipped: ${skipped}`);
  }
}
