import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { ES_SYNC_QUEUE, EsSyncJobData } from './es-sync.types';

/**
 * ES 동기화 프로세서
 * - Contact 생성/수정/삭제 이벤트 처리
 * - 재시도 로직 내장 (BullMQ)
 */
@Processor(ES_SYNC_QUEUE)
export class EsSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EsSyncProcessor.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {
    super();
  }

  /**
   * 작업 처리
   */
  async process(job: Job<EsSyncJobData>): Promise<void> {
    const { type, contactId, payload } = job.data;

    this.logger.debug(`Processing ${type} for contact: ${contactId}`);

    switch (type) {
      case 'CONTACT_CREATED':
      case 'CONTACT_UPDATED':
        if (!payload) {
          throw new Error('Payload is required for index operation');
        }
        await this.elasticsearchService.indexContact(payload);
        break;

      case 'CONTACT_DELETED':
        await this.elasticsearchService.deleteContact(contactId);
        break;

      default:
        this.logger.warn(`Unknown event type: ${type as string}`);
    }

    this.logger.debug(`Completed ${type} for contact: ${contactId}`);
  }

  /**
   * 작업 완료 이벤트
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<EsSyncJobData>) {
    this.logger.log(
      `Job ${job.id} completed: ${job.data.type} for ${job.data.contactId}`,
    );
  }

  /**
   * 작업 실패 이벤트
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<EsSyncJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed: ${job.data.type} for ${job.data.contactId}`,
      error.stack,
    );
  }
}
