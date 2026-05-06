import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Profile } from './profile.entity';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { CsvIngestionService } from './csv-ingestion.service';
import { SeedService } from '../seed/seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile]),
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService, CsvIngestionService, SeedService],
})
export class ProfilesModule {}




// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { Profile } from './profile.entity';
// import { ProfilesController } from './profiles.controller';
// import { ProfilesService } from './profiles.service';
// import { SeedService } from '../seed/seed.service';

// @Module({
//   imports: [TypeOrmModule.forFeature([Profile])],
//   controllers: [ProfilesController],
//   providers: [ProfilesService, SeedService],
// })
// export class ProfilesModule {}
