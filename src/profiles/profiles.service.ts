import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './profile.entity';
import axios from 'axios';
import { v7 as uuidv7 } from 'uuid';

const COUNTRY_MAP: Record<string, string> = {
  nigeria: 'NG',
  ghana: 'GH',
  kenya: 'KE',
  'south africa': 'ZA',
  egypt: 'EG',
  ethiopia: 'ET',
  tanzania: 'TZ',
  uganda: 'UG',
  cameroon: 'CM',
  senegal: 'SN',
  angola: 'AO',
  benin: 'BJ',
  togo: 'TG',
  mali: 'ML',
  niger: 'NE',
  chad: 'TD',
  'ivory coast': 'CI',
  mozambique: 'MZ',
  zambia: 'ZM',
  zimbabwe: 'ZW',
  rwanda: 'RW',
  morocco: 'MA',
  algeria: 'DZ',
  tunisia: 'TN',
  libya: 'LY',
  sudan: 'SD',
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  france: 'FR',
  germany: 'DE',
  canada: 'CA',
  australia: 'AU',
  india: 'IN',
  brazil: 'BR',
};

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private repo: Repository<Profile>,
  ) {}

  async findAll(query: any) {
    const validGenders = ['male', 'female'];
    const validAgeGroups = ['child', 'teenager', 'adult', 'senior'];
    const validSortFields = ['age', 'created_at', 'gender_probability'];
    const validOrders = ['asc', 'desc'];

    if (query.gender && !validGenders.includes(query.gender)) {
      throw { status: 'error', message: 'Invalid query parameters' };
    }
    if (query.age_group && !validAgeGroups.includes(query.age_group)) {
      throw { status: 'error', message: 'Invalid query parameters' };
    }
    if (query.sort_by && !validSortFields.includes(query.sort_by)) {
      throw { status: 'error', message: 'Invalid query parameters' };
    }
    if (query.order && !validOrders.includes(query.order)) {
      throw { status: 'error', message: 'Invalid query parameters' };
    }
    if (
      query.limit &&
      (isNaN(Number(query.limit)) || Number(query.limit) > 50)
    ) {
      throw { status: 'error', message: 'Invalid query parameters' };
    }
    const {
      gender,
      age_group,
      country_id,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by = 'created_at',
      order = 'desc',
      page = 1,
      limit = 10,
    } = query;

    // Validate limit max
    const take = Math.min(Number(limit) || 10, 50);
    const skip = (Number(page - 1) || 0) * take;

    const sortField = validSortFields.includes(sort_by)
      ? sort_by
      : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const qb = this.repo.createQueryBuilder('p');

    if (gender) qb.andWhere('p.gender = :gender', { gender });
    if (age_group) qb.andWhere('p.age_group = :age_group', { age_group });
    if (country_id)
      qb.andWhere('p.country_id = :country_id', {
        country_id: country_id.toUpperCase(),
      });
    if (min_age) qb.andWhere('p.age >= :min_age', { min_age: Number(min_age) });
    if (max_age) qb.andWhere('p.age <= :max_age', { max_age: Number(max_age) });
    if (min_gender_probability)
      qb.andWhere('p.gender_probability >= :mgp', {
        mgp: Number(min_gender_probability),
      });
    if (min_country_probability)
      qb.andWhere('p.country_probability >= :mcp', {
        mcp: Number(min_country_probability),
      });

    qb.orderBy(`p.${sortField}`, sortOrder).skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();

    const totalPages = Math.ceil(total / take);
    const currentPage = Number(page);

    return {
      status: 'success',
      page: currentPage,
      limit: take,
      total,
      total_pages: totalPages,
      links: {
        self: `/api/profiles?page=${currentPage}&limit=${take}`,
        next:
          currentPage < totalPages
            ? `/api/profiles?page=${currentPage + 1}&limit=${take}`
            : null,
        prev:
          currentPage > 1
            ? `/api/profiles?page=${currentPage - 1}&limit=${take}`
            : null,
      },
      data,
    };
  }

  async search(q: string, page: any = 1, limit: any = 10) {
    if (!q || !q.trim()) {
      return { status: 'error', message: 'Missing or empty query parameter' };
    }

    const filters = this.parseQuery(q);

    const hasFilter =
      filters.gender ||
      filters.age_group ||
      filters.country_id ||
      filters.min_age !== undefined ||
      filters.max_age !== undefined;

    if (!hasFilter) {
      return { status: 'error', message: 'Unable to interpret query' };
    }

    const take = Math.min(Number(limit) || 10, 50);
    const skip = (Number(page - 1) || 0) * take;
    const currentPage = Number(page);

    const qb = this.repo.createQueryBuilder('p');

    if (filters.gender)
      qb.andWhere('p.gender = :gender', { gender: filters.gender });
    if (filters.age_group)
      qb.andWhere('p.age_group = :age_group', { age_group: filters.age_group });
    if (filters.country_id)
      qb.andWhere('p.country_id = :country_id', {
        country_id: filters.country_id,
      });
    if (filters.min_age !== undefined)
      qb.andWhere('p.age >= :min_age', { min_age: filters.min_age });
    if (filters.max_age !== undefined)
      qb.andWhere('p.age <= :max_age', { max_age: filters.max_age });

    qb.orderBy('p.created_at', 'DESC').skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / take);

    // Build links preserving the search query
    const encodedQ = encodeURIComponent(q);
    const baseSearchUrl = `/api/profiles/search?q=${encodedQ}&limit=${take}`;

    return {
      status: 'success',
      page: currentPage,
      limit: take,
      total,
      total_pages: totalPages,
      links: {
        self: `${baseSearchUrl}&page=${currentPage}`,
        next:
          currentPage < totalPages
            ? `${baseSearchUrl}&page=${currentPage + 1}`
            : null,
        prev:
          currentPage > 1 ? `${baseSearchUrl}&page=${currentPage - 1}` : null,
      },
      data,
    };
  }

  private parseQuery(q: string) {
    const s = q.toLowerCase().trim();
    const filters: any = {};

    // Gender
    if (/(male and female|female and male)/.test(s)) {
      // both genders - no filter applied
    } else if (/\bmales?\b/.test(s)) {
      filters.gender = 'male';
    } else if (/\bfemales?\b|\bwomen\b|\bwoman\b|\bgirls?\b/.test(s)) {
      filters.gender = 'female';
    }

    // Age group
    if (/\bchildren\b|\bchild\b|\bkids?\b/.test(s)) {
      filters.age_group = 'child';
    } else if (/\bteenagers?\b|\bteens?\b/.test(s)) {
      filters.age_group = 'teenager';
    } else if (/\badults?\b/.test(s)) {
      filters.age_group = 'adult';
    } else if (/\bseniors?\b|\belderly\b/.test(s)) {
      filters.age_group = 'senior';
    } else if (/\byoung\b/.test(s)) {
      filters.min_age = 16;
      filters.max_age = 24;
    }

    // Explicit age
    const above = s.match(/(?:above|over|older than)\s+(\d+)/);
    if (above) filters.min_age = parseInt(above[1]);

    const below = s.match(/(?:below|under|younger than)\s+(\d+)/);
    if (below) filters.max_age = parseInt(below[1]);

    const between = s.match(/between\s+(\d+)\s+and\s+(\d+)/);
    if (between) {
      filters.min_age = parseInt(between[1]);
      filters.max_age = parseInt(between[2]);
    }

    // Country
    for (const [name, iso] of Object.entries(COUNTRY_MAP)) {
      if (s.includes(name)) {
        filters.country_id = iso;
        break;
      }
    }

    return filters;
  }

  async exportCsv(query: any): Promise<string> {
    const result = await this.findAll({ ...query, limit: '9999' });
    const headers = [
      'id',
      'name',
      'gender',
      'gender_probability',
      'age',
      'age_group',
      'country_id',
      'country_name',
      'country_probability',
      'created_at',
    ];

    const rows = result.data.map((p: any) =>
      headers.map((h) => `"${p[h] ?? ''}"`).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  async createFromName(name: string): Promise<any> {
    let gender = 'unknown';
    let gender_probability = 0;
    let age = 25;
    let country_id = 'NG';
    let country_name = 'Nigeria';
    let country_probability = 0;

    try {
      const genderRes = await axios.get(
        `https://api.genderize.io?name=${name}`,
      );
      gender = genderRes.data.gender || 'unknown';
      gender_probability = genderRes.data.probability || 0;
    } catch (error) {
      // Silently fail - defaults remain
    }

    try {
      const ageRes = await axios.get(`https://api.agify.io?name=${name}`);
      age = ageRes.data.age || 25;
    } catch (error) {
      // Silently fail - defaults remain
    }

    try {
      const countryRes = await axios.get(
        `https://api.nationalize.io?name=${name}`,
      );
      const top = countryRes.data.country?.[0];
      if (top) {
        country_id = top.country_id;
        country_probability = top.probability;
        country_name = top.country_id;
      }
    } catch (error) {
      // Silently fail - defaults remain
    }

    const age_group =
      age < 13
        ? 'child'
        : age < 20
          ? 'teenager'
          : age < 60
            ? 'adult'
            : 'senior';

    const profile = this.repo.create({
      id: uuidv7(),
      name,
      gender,
      gender_probability,
      age,
      age_group,
      country_id,
      country_name,
      country_probability,
    });

    return this.repo.save(profile);
  }
}

// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Profile } from './profile.entity';

// const COUNTRY_MAP: Record<string, string> = {
//   nigeria: 'NG',
//   ghana: 'GH',
//   kenya: 'KE',
//   'south africa': 'ZA',
//   egypt: 'EG',
//   ethiopia: 'ET',
//   tanzania: 'TZ',
//   uganda: 'UG',
//   cameroon: 'CM',
//   senegal: 'SN',
//   angola: 'AO',
//   benin: 'BJ',
//   togo: 'TG',
//   mali: 'ML',
//   niger: 'NE',
//   chad: 'TD',
//   'ivory coast': 'CI',
//   mozambique: 'MZ',
//   zambia: 'ZM',
//   zimbabwe: 'ZW',
//   rwanda: 'RW',
//   morocco: 'MA',
//   algeria: 'DZ',
//   tunisia: 'TN',
//   libya: 'LY',
//   sudan: 'SD',
//   'united states': 'US',
//   usa: 'US',
//   'united kingdom': 'GB',
//   uk: 'GB',
//   france: 'FR',
//   germany: 'DE',
//   canada: 'CA',
//   australia: 'AU',
//   india: 'IN',
//   brazil: 'BR',
// };

// @Injectable()
// export class ProfilesService {
//   constructor(
//     @InjectRepository(Profile)
//     private repo: Repository<Profile>,
//   ) {}

//   async findAll(query: any) {
//     const validGenders = ['male', 'female'];
//     const validAgeGroups = ['child', 'teenager', 'adult', 'senior'];
//     const validSortFields = ['age', 'created_at', 'gender_probability'];
//     const validOrders = ['asc', 'desc'];

//     if (query.gender && !validGenders.includes(query.gender)) {
//       throw { status: 'error', message: 'Invalid query parameters' };
//     }
//     if (query.age_group && !validAgeGroups.includes(query.age_group)) {
//       throw { status: 'error', message: 'Invalid query parameters' };
//     }
//     if (query.sort_by && !validSortFields.includes(query.sort_by)) {
//       throw { status: 'error', message: 'Invalid query parameters' };
//     }
//     if (query.order && !validOrders.includes(query.order)) {
//       throw { status: 'error', message: 'Invalid query parameters' };
//     }
//     if (
//       query.limit &&
//       (isNaN(Number(query.limit)) || Number(query.limit) > 50)
//     ) {
//       throw { status: 'error', message: 'Invalid query parameters' };
//     }
//     const {
//       gender,
//       age_group,
//       country_id,
//       min_age,
//       max_age,
//       min_gender_probability,
//       min_country_probability,
//       sort_by = 'created_at',
//       order = 'desc',
//       page = 1,
//       limit = 10,
//     } = query;

//     // Validate limit max
//     const take = Math.min(Number(limit) || 10, 50);
//     const skip = (Number(page - 1) || 0) * take;

//     const sortField = validSortFields.includes(sort_by)
//       ? sort_by
//       : 'created_at';
//     const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

//     const qb = this.repo.createQueryBuilder('p');

//     if (gender) qb.andWhere('p.gender = :gender', { gender });
//     if (age_group) qb.andWhere('p.age_group = :age_group', { age_group });
//     if (country_id)
//       qb.andWhere('p.country_id = :country_id', {
//         country_id: country_id.toUpperCase(),
//       });
//     if (min_age) qb.andWhere('p.age >= :min_age', { min_age: Number(min_age) });
//     if (max_age) qb.andWhere('p.age <= :max_age', { max_age: Number(max_age) });
//     if (min_gender_probability)
//       qb.andWhere('p.gender_probability >= :mgp', {
//         mgp: Number(min_gender_probability),
//       });
//     if (min_country_probability)
//       qb.andWhere('p.country_probability >= :mcp', {
//         mcp: Number(min_country_probability),
//       });

//     qb.orderBy(`p.${sortField}`, sortOrder).skip(skip).take(take);

//     const [data, total] = await qb.getManyAndCount();

//     const totalPages = Math.ceil(total / take);
//     const currentPage = Number(page);

//     return {
//       status: 'success',
//       page: currentPage,
//       limit: take,
//       total,
//       total_pages: totalPages,
//       links: {
//         self: `/api/profiles?page=${currentPage}&limit=${take}`,
//         next:
//           currentPage < totalPages
//             ? `/api/profiles?page=${currentPage + 1}&limit=${take}`
//             : null,
//         prev:
//           currentPage > 1
//             ? `/api/profiles?page=${currentPage - 1}&limit=${take}`
//             : null,
//       },
//       data,
//     };
//   }

//   async search(q: string, page: any = 1, limit: any = 10) {
//     if (!q || !q.trim()) {
//       return { status: 'error', message: 'Missing or empty query parameter' };
//     }

//     const filters = this.parseQuery(q);

//     const hasFilter =
//       filters.gender ||
//       filters.age_group ||
//       filters.country_id ||
//       filters.min_age !== undefined ||
//       filters.max_age !== undefined;

//     if (!hasFilter) {
//       return { status: 'error', message: 'Unable to interpret query' };
//     }

//     const take = Math.min(Number(limit) || 10, 50);
//     const skip = (Number(page - 1) || 0) * take;

//     const qb = this.repo.createQueryBuilder('p');

//     if (filters.gender)
//       qb.andWhere('p.gender = :gender', { gender: filters.gender });
//     if (filters.age_group)
//       qb.andWhere('p.age_group = :age_group', { age_group: filters.age_group });
//     if (filters.country_id)
//       qb.andWhere('p.country_id = :country_id', {
//         country_id: filters.country_id,
//       });
//     if (filters.min_age !== undefined)
//       qb.andWhere('p.age >= :min_age', { min_age: filters.min_age });
//     if (filters.max_age !== undefined)
//       qb.andWhere('p.age <= :max_age', { max_age: filters.max_age });

//     qb.orderBy('p.created_at', 'DESC').skip(skip).take(take);

//     const [data, total] = await qb.getManyAndCount();

//     return { status: 'success', page: Number(page), limit: take, total, data };
//   }

//   private parseQuery(q: string) {
//     const s = q.toLowerCase().trim();
//     const filters: any = {};

//     // Gender
//     if (/(male and female|female and male)/.test(s)) {
//       // no filter
//     } else if (/\bmales?\b/.test(s)) {
//       filters.gender = 'male';
//     } else if (/\bfemales?\b|\bwomen\b|\bwoman\b|\bgirls?\b/.test(s)) {
//       filters.gender = 'female';
//     }

//     // Age group
//     if (/\bchildren\b|\bchild\b|\bkids?\b/.test(s)) {
//       filters.age_group = 'child';
//     } else if (/\bteenagers?\b|\bteens?\b/.test(s)) {
//       filters.age_group = 'teenager';
//     } else if (/\badults?\b/.test(s)) {
//       filters.age_group = 'adult';
//     } else if (/\bseniors?\b|\belderly\b/.test(s)) {
//       filters.age_group = 'senior';
//     } else if (/\byoung\b/.test(s)) {
//       filters.min_age = 16;
//       filters.max_age = 24;
//     }

//     // Explicit age
//     const above = s.match(/(?:above|over|older than)\s+(\d+)/);
//     if (above) filters.min_age = parseInt(above[1]);

//     const below = s.match(/(?:below|under|younger than)\s+(\d+)/);
//     if (below) filters.max_age = parseInt(below[1]);

//     const between = s.match(/between\s+(\d+)\s+and\s+(\d+)/);
//     if (between) {
//       filters.min_age = parseInt(between[1]);
//       filters.max_age = parseInt(between[2]);
//     }

//     // Country
//     for (const [name, iso] of Object.entries(COUNTRY_MAP)) {
//       if (s.includes(name)) {
//         filters.country_id = iso;
//         break;
//       }
//     }

//     return filters;
//   }

//   // Add this to your existing ProfilesService class

//   async exportCsv(query: any): Promise<string> {
//     const result = await this.findAll({ ...query, limit: '9999' });
//     const headers = [
//       'id',
//       'name',
//       'gender',
//       'gender_probability',
//       'age',
//       'age_group',
//       'country_id',
//       'country_name',
//       'country_probability',
//       'created_at',
//     ];

//     const rows = result.data.map((p: any) =>
//       headers.map((h) => `"${p[h] ?? ''}"`).join(','),
//     );

//     return [headers.join(','), ...rows].join('\n');
//   }

//   async createFromName(name: string): Promise<any> {
//     // Call external APIs to get gender, age, country data
//     const axios = require('axios');

//     let gender = 'unknown';
//     let gender_probability = 0;
//     let age = 25;
//     let country_id = 'NG';
//     let country_name = 'Nigeria';
//     let country_probability = 0;

//     try {
//       const genderRes = await axios.get(
//         `https://api.genderize.io?name=${name}`,
//       );
//       gender = genderRes.data.gender || 'unknown';
//       gender_probability = genderRes.data.probability || 0;
//     } catch {}

//     try {
//       const ageRes = await axios.get(`https://api.agify.io?name=${name}`);
//       age = ageRes.data.age || 25;
//     } catch {}

//     try {
//       const countryRes = await axios.get(
//         `https://api.nationalize.io?name=${name}`,
//       );
//       const top = countryRes.data.country?.[0];
//       if (top) {
//         country_id = top.country_id;
//         country_probability = top.probability;
//         country_name = top.country_id;
//       }
//     } catch {}

//     const age_group =
//       age < 13
//         ? 'child'
//         : age < 20
//           ? 'teenager'
//           : age < 60
//             ? 'adult'
//             : 'senior';

//     const profile = this.repo.create({
//       id: require('uuid').v7(),
//       name,
//       gender,
//       gender_probability,
//       age,
//       age_group,
//       country_id,
//       country_name,
//       country_probability,
//     });

//     return this.repo.save(profile);
//   }
// }
