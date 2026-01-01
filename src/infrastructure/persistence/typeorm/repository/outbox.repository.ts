import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, LessThan } from 'typeorm';
import { OutboxEntity, OutboxStatus } from '../entity/outbox.entity';

/**
 * Outbox Repository
 * - Outbox 이벤트 CRUD
 * - Cron 처리를 위한 조회
 */
@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(OutboxEntity)
    private readonly repository: Repository<OutboxEntity>,
  ) {}

  /**
   * Outbox 이벤트 저장 (트랜잭션 매니저 사용)
   */
  async saveWithManager(
    manager: EntityManager,
    outbox: OutboxEntity,
  ): Promise<void> {
    await manager.save(OutboxEntity, outbox);
  }

  /**
   * PENDING 상태 이벤트 조회 (Cron용)
   */
  async findPending(limit: number = 100): Promise<OutboxEntity[]> {
    return this.repository.find({
      where: { status: 'PENDING' as OutboxStatus },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * 재시도 대상 FAILED 이벤트 조회 (최대 5회 미만)
   */
  async findRetryable(limit: number = 50): Promise<OutboxEntity[]> {
    return this.repository.find({
      where: {
        status: 'FAILED' as OutboxStatus,
        retryCount: LessThan(5),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  /**
   * 상태 업데이트
   */
  async updateStatus(
    id: string,
    status: OutboxStatus,
    errorMessage?: string,
  ): Promise<void> {
    if (status === 'DONE') {
      await this.repository.update(id, {
        status,
        processedAt: new Date(),
      });
    } else if (status === 'FAILED') {
      await this.repository.increment({ id }, 'retryCount', 1);
      await this.repository.update(id, {
        status,
        errorMessage: errorMessage ?? null,
      });
    } else {
      await this.repository.update(id, { status });
    }
  }

  /**
   * PROCESSING 상태로 변경 (락 용도)
   */
  async markAsProcessing(id: string): Promise<boolean> {
    const result = await this.repository.update(
      { id, status: 'PENDING' as OutboxStatus },
      { status: 'PROCESSING' as OutboxStatus },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * 오래된 완료 이벤트 정리 (7일 이상)
   */
  async cleanupOldEvents(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.repository.delete({
      status: 'DONE' as OutboxStatus,
      processedAt: LessThan(cutoffDate),
    });

    return result.affected ?? 0;
  }
}
