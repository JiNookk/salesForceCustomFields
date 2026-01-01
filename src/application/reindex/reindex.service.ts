import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { ContactRepositoryPort } from '../contact/port/contact.repository.port';
import { CONTACT_REPOSITORY } from '../contact/port/contact.repository.port';
import {
  ES_SYNC_QUEUE,
  type EsSyncJobData,
  type ContactPayload,
} from '../../infrastructure/queue/es-sync.types';
import type { Contact } from '../../domain/contact/contact.domain';

/**
 * 재인덱싱 서비스
 * - 전체 Contact를 ES에 다시 인덱싱
 * - 동기화 실패 복구용 (JIN-181)
 */
@Injectable()
export class ReindexService {
  private readonly logger = new Logger(ReindexService.name);

  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
    @InjectQueue(ES_SYNC_QUEUE)
    private readonly esSyncQueue: Queue<EsSyncJobData>,
  ) {}

  /**
   * 전체 Contact 재인덱싱
   * @returns 인덱싱 작업 추가된 Contact 수
   */
  async reindexAll(): Promise<{ queued: number }> {
    this.logger.log('Starting full reindex...');

    const contacts = await this.contactRepository.findAll();
    let queued = 0;

    for (const contact of contacts) {
      await this.esSyncQueue.add(
        'reindex',
        {
          type: 'CONTACT_UPDATED',
          contactId: contact.id,
          payload: this.toPayload(contact),
          timestamp: new Date(),
        },
        {
          priority: 10, // 낮은 우선순위 (일반 작업보다 뒤에 처리)
        },
      );
      queued++;
    }

    this.logger.log(`Queued ${queued} contacts for reindexing`);
    return { queued };
  }

  /**
   * 특정 Contact 재인덱싱
   */
  async reindexOne(contactId: string): Promise<void> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    await this.esSyncQueue.add('reindex', {
      type: 'CONTACT_UPDATED',
      contactId: contact.id,
      payload: this.toPayload(contact),
      timestamp: new Date(),
    });

    this.logger.log(`Queued contact ${contactId} for reindexing`);
  }

  /**
   * Queue 상태 조회
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.esSyncQueue.getWaitingCount(),
      this.esSyncQueue.getActiveCount(),
      this.esSyncQueue.getCompletedCount(),
      this.esSyncQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  private toPayload(contact: Contact): ContactPayload {
    const customFields: Record<string, string | number | Date | null> = {};

    for (const fieldValue of contact.customFieldValues) {
      customFields[fieldValue.fieldDefinition.apiName] = fieldValue.getValue();
    }

    return {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      customFields,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}
