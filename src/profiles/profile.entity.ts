import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('profiles')
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
      this.id = uuidv4();
    }
  }
}
