import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Contact } from '../../domain/contact/contact.domain';
import type { ContactRepositoryPort } from './port/contact.repository.port';
import { CONTACT_REPOSITORY } from './port/contact.repository.port';
import type { CustomFieldDefinitionRepositoryPort } from '../customField/port/customFieldDefinition.repository.port';
import { CUSTOM_FIELD_DEFINITION_REPOSITORY } from '../customField/port/customFieldDefinition.repository.port';
import type { CreateContactDto } from './dto/createContact.dto';
import type { UpdateContactDto } from './dto/updateContact.dto';
import {
  ES_SYNC_QUEUE,
  type EsSyncJobData,
  type ContactPayload,
} from '../../infrastructure/queue/es-sync.types';
import { ContactEntity } from '../../infrastructure/persistence/typeorm/entity/contact.entity';
import { CustomFieldValueEntity } from '../../infrastructure/persistence/typeorm/entity/customFieldValue.entity';
import {
  OutboxEntity,
  type OutboxEventType,
} from '../../infrastructure/persistence/typeorm/entity/outbox.entity';
import { ContactMapper } from '../../infrastructure/persistence/typeorm/mapper/contact.mapper';

/**
 * Contact 서비스
 * - Outbox 패턴으로 트랜잭션 보장 (Contact + Outbox 동일 트랜잭션)
 * - BullMQ로 빠른 비동기 처리 시도
 * - Cron fallback으로 누락 이벤트 처리 (JIN-181)
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
    @Inject(CUSTOM_FIELD_DEFINITION_REPOSITORY)
    private readonly fieldDefinitionRepository: CustomFieldDefinitionRepositoryPort,
    @InjectQueue(ES_SYNC_QUEUE)
    private readonly esSyncQueue: Queue<EsSyncJobData>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Contact 생성
   * - 트랜잭션: Contact + Outbox 저장
   * - 트랜잭션 후: Queue에 작업 추가 (best-effort)
   */
  async create(dto: CreateContactDto): Promise<Contact> {
    // 이메일 중복 체크
    const existing = await this.contactRepository.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException(`이미 존재하는 이메일입니다: ${dto.email}`);
    }

    const id = uuidv4();
    const now = new Date();

    const contact = Contact.create({
      id,
      email: dto.email,
      name: dto.name,
      createdAt: now,
      updatedAt: now,
    });

    // 커스텀 필드 값 설정
    if (dto.customFields) {
      await this.setCustomFieldValues(contact, dto.customFields);
    }

    // 트랜잭션: Contact + Outbox 저장
    await this.saveWithOutbox(contact, 'CONTACT_CREATED');

    // Queue에 작업 추가 (best-effort, 실패해도 Cron이 처리)
    await this.tryEnqueueEsSync('CONTACT_CREATED', contact);

    return contact;
  }

  /**
   * ID로 Contact 조회
   */
  async findById(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(id);
    if (!contact) {
      throw new NotFoundException(`Contact를 찾을 수 없습니다: ${id}`);
    }
    return contact;
  }

  /**
   * 모든 Contact 조회
   */
  async findAll(): Promise<Contact[]> {
    return this.contactRepository.findAll();
  }

  /**
   * Contact 수정
   */
  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.findById(id);

    // 이름 업데이트
    if (dto.name !== undefined) {
      contact.updateName(dto.name, new Date());
    }

    // 커스텀 필드 값 업데이트
    if (dto.customFields) {
      await this.setCustomFieldValues(contact, dto.customFields);
    }

    // 트랜잭션: Contact + Outbox 저장
    await this.saveWithOutbox(contact, 'CONTACT_UPDATED');

    // Queue에 작업 추가 (best-effort)
    await this.tryEnqueueEsSync('CONTACT_UPDATED', contact);

    return contact;
  }

  /**
   * Contact 삭제
   */
  async delete(id: string): Promise<void> {
    // 존재 확인
    await this.findById(id);

    // 트랜잭션: Contact 삭제 + Outbox 저장
    await this.deleteWithOutbox(id);

    // Queue에 작업 추가 (best-effort)
    await this.tryEnqueueDeleteSync(id);
  }

  /**
   * Contact + Outbox를 같은 트랜잭션에서 저장
   */
  private async saveWithOutbox(
    contact: Contact,
    eventType: OutboxEventType,
  ): Promise<void> {
    const payload = this.toPayload(contact);

    await this.dataSource.transaction(async (manager) => {
      // Contact Entity 변환
      const contactEntity = ContactMapper.toEntity(contact);

      // 기존 CustomFieldValues 삭제
      await manager.delete(CustomFieldValueEntity, { contactId: contact.id });

      // Contact + CustomFieldValues 저장
      await manager.save(ContactEntity, contactEntity);

      // Outbox 이벤트 저장 (같은 트랜잭션)
      const outbox = OutboxEntity.create({
        id: uuidv4(),
        aggregateType: 'Contact',
        aggregateId: contact.id,
        eventType,
        payload: payload as unknown as Record<string, unknown>,
      });
      await manager.save(OutboxEntity, outbox);
    });
  }

  /**
   * Contact 삭제 + Outbox를 같은 트랜잭션에서 처리
   */
  private async deleteWithOutbox(contactId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Contact 삭제 (CASCADE로 CustomFieldValues도 삭제)
      await manager.delete(ContactEntity, { id: contactId });

      // Outbox 이벤트 저장
      const outbox = OutboxEntity.create({
        id: uuidv4(),
        aggregateType: 'Contact',
        aggregateId: contactId,
        eventType: 'CONTACT_DELETED',
        payload: { id: contactId },
      });
      await manager.save(OutboxEntity, outbox);
    });
  }

  /**
   * Queue에 ES 동기화 작업 추가 (best-effort)
   * - Redis 실패해도 Outbox Cron이 처리
   */
  private async tryEnqueueEsSync(
    type: 'CONTACT_CREATED' | 'CONTACT_UPDATED',
    contact: Contact,
  ): Promise<void> {
    try {
      const payload = this.toPayload(contact);
      await this.esSyncQueue.add('sync', {
        type,
        contactId: contact.id,
        payload,
        timestamp: new Date(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Queue 추가 실패 (Cron이 처리 예정): ${message}`);
    }
  }

  /**
   * Queue에 삭제 동기화 작업 추가 (best-effort)
   */
  private async tryEnqueueDeleteSync(contactId: string): Promise<void> {
    try {
      await this.esSyncQueue.add('sync', {
        type: 'CONTACT_DELETED',
        contactId,
        timestamp: new Date(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Queue 추가 실패 (Cron이 처리 예정): ${message}`);
    }
  }

  /**
   * 커스텀 필드 값 설정 헬퍼
   */
  private async setCustomFieldValues(
    contact: Contact,
    customFields: Record<string, string | number | Date | null>,
  ): Promise<void> {
    for (const [apiName, value] of Object.entries(customFields)) {
      const definition =
        await this.fieldDefinitionRepository.findByApiName(apiName);

      if (!definition) {
        throw new BadRequestException(
          `존재하지 않는 커스텀 필드입니다: ${apiName}`,
        );
      }

      if (!definition.isActive) {
        throw new BadRequestException(
          `비활성화된 커스텀 필드입니다: ${apiName}`,
        );
      }

      if (value === null) {
        // null인 경우 필드 값 제거
        contact.removeCustomFieldValue(apiName);
      } else {
        // 값 설정 (도메인에서 검증)
        const fieldValueId = uuidv4();
        contact.setCustomFieldValue(definition, value, fieldValueId);
      }
    }
  }

  /**
   * Contact -> Queue Payload 변환
   */
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
