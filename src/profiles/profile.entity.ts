import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database indexes strategy for Stage 4b:
 *
 * The most common query pattern is filtering by gender + country_id + age together.
 * A composite index on (gender, country_id, age) lets PostgreSQL satisfy these
 * multi-column filters in a single B-tree traversal instead of scanning all rows
 * that match gender first and then applying the other filters row-by-row.
 *
 * Individual indexes on each column remain for single-filter queries
 * (e.g. "all adults" or "all Nigerians") where the composite index would not help.
 *
 * Without these indexes: EXPLAIN ANALYZE shows Seq Scan on 1M+ rows → slow.
 * With these indexes: Index Scan using the appropriate index → fast.
 */
@Entity('profiles')
// Composite index — covers the most common multi-filter query pattern
@Index('IDX_profiles_gender_country_age', ['gender', 'country_id', 'age'])
// Individual indexes for single-column filter queries
@Index('IDX_profiles_gender', ['gender'])
@Index('IDX_profiles_country_id', ['country_id'])
@Index('IDX_profiles_age_group', ['age_group'])
@Index('IDX_profiles_age', ['age'])
export class Profile {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  gender: string;

  @Column({ type: 'float' })
  gender_probability: number;

  @Column({ type: 'int' })
  age: number;

  @Column()
  age_group: string;

  @Column({ length: 2 })
  country_id: string;

  @Column()
  country_name: string;

  @Column({ type: 'float' })
  country_probability: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      // ID is set externally with uuidv7 — this is a fallback
      this.id = uuidv4();
    }
  }
}

// import {
//   Entity,
//   Column,
//   PrimaryColumn,
//   CreateDateColumn,
//   BeforeInsert,
// } from 'typeorm';
// import { v4 as uuidv4 } from 'uuid';

// @Entity('profiles')
// export class Profile {
//   @PrimaryColumn()
//   id: string;

//   @Column({ unique: true })
//   name: string;

//   @Column()
//   gender: string;

//   @Column({ type: 'float' })s
//   gender_probability: number;

//   @Column({ type: 'int' })
//   age: number;

//   @Column()
//   age_group: string;

//   @Column({ length: 2 })
//   country_id: string;

//   @Column()
//   country_name: string;

//   @Column({ type: 'float' })
//   country_probability: number;

//   @CreateDateColumn({ type: 'timestamptz' })
//   created_at: Date;

//   @BeforeInsert()
//   generateId() {
//     if (!this.id) {
//       this.id = uuidv4();
//     }
//   }
// }
