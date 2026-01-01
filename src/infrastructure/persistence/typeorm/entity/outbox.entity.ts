import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type OutboxEventType =
  | 'CONTACT_CREATED'
  | 'CONTACT_UPDATED'
  | 'CONTACT_DELETED';

/**
 * Outbox 테이블 엔티티
 * - 트랜잭션 보장을 위한 이벤트 저장소
 * - Contact 저장과 같은 트랜잭션으로 저장
 */
@Entity('outbox')
@Index('idx_outbox_status_created', ['status', 'createdAt'])
export class OutboxEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'aggregate_type' })
  aggregateType: string; // 'Contact'

  @Column({ type: 'varchar', length: 36, name: 'aggregate_id' })
  aggregateId: string; // contact.id

  @Column({ type: 'varchar', length: 50, name: 'event_type' })
  eventType: OutboxEventType;

  @Column({ type: 'json' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'DONE', 'FAILED'],
    default: 'PENDING',
  })
  status: OutboxStatus;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'processed_at' })
  processedAt: Date | null;

  /**
   * Outbox 이벤트 생성 팩토리 메서드
   */
  static create(args: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: OutboxEventType;
    payload: Record<string, unknown>;
  }): OutboxEntity {
    const entity = new OutboxEntity();
    entity.id = args.id;
    entity.aggregateType = args.aggregateType;
    entity.aggregateId = args.aggregateId;
    entity.eventType = args.eventType;
    entity.payload = args.payload;
    entity.status = 'PENDING';
    entity.retryCount = 0;
    entity.errorMessage = null;
    entity.processedAt = null;
    return entity;
  }
}
