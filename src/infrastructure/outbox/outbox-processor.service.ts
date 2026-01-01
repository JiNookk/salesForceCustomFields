import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OutboxRepository } from '../persistence/typeorm/repository/outbox.repository';
import type { OutboxEntity } from '../persistence/typeorm/entity/outbox.entity';
import {
  ES_SYNC_QUEUE,
  type EsSyncJobData,
  type ContactPayload,
} from '../queue/es-sync.types';

/**
 * Outbox Processor
 * - Cron으로 PENDING 상태 이벤트 처리
 * - Redis Queue 실패 시 fallback 역할
 * - FAILED 이벤트 재시도 (최대 5회)
 */
@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly outboxRepository: OutboxRepository,
    @InjectQueue(ES_SYNC_QUEUE)
    private readonly esSyncQueue: Queue<EsSyncJobData>,
  ) {}

  /**
   * PENDING 이벤트 처리 (10초마다)
   * - Redis Queue에 추가하고 상태를 DONE으로 변경
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingEvents(): Promise<void> {
    const pendingEvents = await this.outboxRepository.findPending(100);

    if (pendingEvents.length === 0) {
      return;
    }

    this.logger.log(`Processing ${pendingEvents.length} pending outbox events`);

    for (const event of pendingEvents) {
      await this.processEvent(event);
    }
  }

  /**
   * FAILED 이벤트 재시도 (1분마다)
   * - 최대 5회까지 재시도
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedEvents(): Promise<void> {
    const failedEvents = await this.outboxRepository.findRetryable(50);

    if (failedEvents.length === 0) {
      return;
    }

    this.logger.log(`Retrying ${failedEvents.length} failed outbox events`);

    for (const event of failedEvents) {
      await this.processEvent(event);
    }
  }

  /**
   * 오래된 완료 이벤트 정리 (매일 자정)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldEvents(): Promise<void> {
    const deleted = await this.outboxRepository.cleanupOldEvents(7);
    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} old outbox events`);
    }
  }

  /**
   * 개별 이벤트 처리
   */
  private async processEvent(event: OutboxEntity): Promise<void> {
    // PROCESSING 상태로 변경 (동시 처리 방지)
    const acquired = await this.outboxRepository.markAsProcessing(event.id);
    if (!acquired) {
      return; // 다른 프로세스가 처리 중
    }

    try {
      // Queue에 작업 추가
      await this.esSyncQueue.add('sync', this.toJobData(event));

      // 성공 시 DONE 처리
      await this.outboxRepository.updateStatus(event.id, 'DONE');

      this.logger.debug(`Processed outbox event: ${event.id}`);
    } catch (error) {
      // 실패 시 FAILED 처리
      await this.outboxRepository.updateStatus(
        event.id,
        'FAILED',
        (error as Error).message,
      );

      this.logger.warn(
        `Failed to process outbox event ${event.id}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Outbox 이벤트 -> Queue Job 데이터 변환
   */
  private toJobData(event: OutboxEntity): EsSyncJobData {
    const payload = event.payload as unknown as ContactPayload;

    return {
      type: event.eventType,
      contactId: event.aggregateId,
      payload: event.eventType !== 'CONTACT_DELETED' ? payload : undefined,
      timestamp: event.createdAt,
    };
  }
}
