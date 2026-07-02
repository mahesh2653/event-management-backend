import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./User";

// One row per login. Only ONE row per user should have isActive = true at a time.
// Logging in from a new browser/device invalidates the previous active row,
// and a socket event is emitted to force-logout the old session in real time.
@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: string;

  // Hash of the refresh token (never store raw tokens)
  @Column({ type: "varchar", length: 255 })
  refreshTokenHash!: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  browser!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  deviceInfo!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ipAddress!: string | null;

  @Index()
  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  revokedAt!: Date | null;
}
