import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Category } from './Category';
import { User } from './User';
import { EventMedia } from './EventMedia';

// draft: not ready. scheduled: publishAt is in the future. published: publishAt has passed.
// deleted: soft-deleted (kept for "temporary delete" / restore).
export type EventStatus = 'draft' | 'scheduled' | 'published' | 'deleted';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @ManyToOne(() => Category, (category) => category.events, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category!: Category | null;

  @Column({ nullable: true })
  categoryId!: string | null;

  // ALWAYS stored in UTC. This is the single source of truth for "is it published yet".
  @Index()
  @Column({ type: 'timestamp' })
  publishAt!: Date;

  // IANA timezone the event was authored in (e.g. "Asia/Kolkata"), kept so we can
  // always re-derive the organizer's original local time if needed.
  @Column({ type: 'varchar', length: 64 })
  sourceTimezone!: string;

  @Column({ type: 'enum', enum: ['draft', 'scheduled', 'published', 'deleted'], default: 'scheduled' })
  status!: EventStatus;

  // Soft delete (temporary delete). Permanent delete removes the row entirely.
  @Column({ default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => User, (user) => user.events, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;

  @Column({ nullable: true })
  createdById!: string | null;

  @OneToMany(() => EventMedia, (media) => media.event, { cascade: true })
  media!: EventMedia[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
