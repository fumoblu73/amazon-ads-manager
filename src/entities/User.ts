import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { KdpBook } from './KdpBook';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash', nullable: true })
  passwordHash: string | null;

  // Amazon OAuth fields
  @Column({ type: 'varchar', length: 100, name: 'amazon_user_id', unique: true, nullable: true })
  amazonUserId: string | null;

  @Column({ type: 'text', name: 'access_token', nullable: true })
  accessToken: string | null;

  @Column({ type: 'text', name: 'refresh_token', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'bigint', name: 'profile_id', nullable: true })
  profileId: number | null;

  @Column({ type: 'varchar', length: 10, name: 'country_code', nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 10, name: 'currency_code', nullable: true })
  currencyCode: string | null;

  @Column({ type: 'timestamp', name: 'token_expires_at', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'timestamp', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => KdpBook, (book) => book.user)
  kdpBooks: KdpBook[];
}
