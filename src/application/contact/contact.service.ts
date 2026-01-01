import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Contact } from '../../domain/contact/contact.domain';
import type { ContactRepositoryPort } from './port/contact.repository.port';
import { CONTACT_REPOSITORY } from './port/contact.repository.port';
import type { CustomFieldDefinitionRepositoryPort } from '../customField/port/customFieldDefinition.repository.port';
import { CUSTOM_FIELD_DEFINITION_REPOSITORY } from '../customField/port/customFieldDefinition.repository.port';
import type { CreateContactDto } from './dto/createContact.dto';
import type { UpdateContactDto } from './dto/updateContact.dto';
import {
  ElasticsearchService,
  type ContactDocument,
} from '../../infrastructure/elasticsearch/elasticsearch.service';

/**
 * Contact 서비스
 */
@Injectable()
export class ContactService {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: ContactRepositoryPort,
    @Inject(CUSTOM_FIELD_DEFINITION_REPOSITORY)
    private readonly fieldDefinitionRepository: CustomFieldDefinitionRepositoryPort,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  /**
   * Contact 생성
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

    await this.contactRepository.save(contact);

    // ES 동기화
    await this.syncToElasticsearch(contact);

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

    await this.contactRepository.save(contact);

    // ES 동기화
    await this.syncToElasticsearch(contact);

    return contact;
  }

  /**
   * Contact 삭제
   */
  async delete(id: string): Promise<void> {
    // 존재 확인
    await this.findById(id);
    await this.contactRepository.delete(id);

    // ES에서 삭제
    await this.elasticsearchService.deleteContact(id);
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
   * ES에 Contact 동기화
   */
  private async syncToElasticsearch(contact: Contact): Promise<void> {
    const document = this.toDocument(contact);
    await this.elasticsearchService.indexContact(document);
  }

  /**
   * Contact -> ES Document 변환
   */
  private toDocument(contact: Contact): ContactDocument {
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
