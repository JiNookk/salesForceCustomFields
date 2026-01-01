import { Contact } from '../../../../domain/contact/contact.domain';
import { CustomFieldDefinition } from '../../../../domain/customField/customFieldDefinition.domain';
import { CustomFieldValue } from '../../../../domain/customField/customFieldValue.domain';
import { ContactEntity } from '../entity/contact.entity';
import { CustomFieldValueEntity } from '../entity/customFieldValue.entity';
import type { FieldType } from '../../../../domain/customField/fieldType.vo';

/**
 * Contact Entity <-> Domain 매퍼
 */
export class ContactMapper {
  /**
   * Entity -> Domain 변환
   */
  static toDomain(
    entity: ContactEntity,
    fieldDefinitions: Map<string, CustomFieldDefinition>,
  ): Contact {
    // CustomFieldValue 엔티티들을 도메인으로 변환
    const customFieldValues: CustomFieldValue[] = [];

    if (entity.customFieldValues) {
      for (const valueEntity of entity.customFieldValues) {
        const definition = fieldDefinitions.get(valueEntity.fieldDefinitionId);
        if (!definition) {
          // 정의가 없으면 스킵 (삭제된 필드일 수 있음)
          continue;
        }

        const value = this.extractValueFromEntity(
          valueEntity,
          definition.fieldType,
        );
        if (value !== null && value !== undefined) {
          const fieldValue = CustomFieldValue.create({
            id: valueEntity.id,
            fieldDefinition: definition,
            value,
          });
          customFieldValues.push(fieldValue);
        }
      }
    }

    return Contact.reconstitute({
      id: entity.id,
      email: entity.email,
      name: entity.name,
      customFieldValues,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  /**
   * Domain -> Entity 변환
   */
  static toEntity(domain: Contact): ContactEntity {
    const entity = new ContactEntity();
    entity.id = domain.id;
    entity.email = domain.email;
    entity.name = domain.name;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    // CustomFieldValues 변환
    entity.customFieldValues = domain.customFieldValues.map((fieldValue) =>
      this.fieldValueToEntity(fieldValue, domain.id),
    );

    return entity;
  }

  /**
   * CustomFieldValue Domain -> Entity 변환
   */
  private static fieldValueToEntity(
    fieldValue: CustomFieldValue,
    contactId: string,
  ): CustomFieldValueEntity {
    const entity = new CustomFieldValueEntity();
    entity.id = fieldValue.id;
    entity.contactId = contactId;
    entity.fieldDefinitionId = fieldValue.fieldDefinition.id;

    // 타입별로 적절한 컬럼에 값 설정
    entity.valueText = null;
    entity.valueNumber = null;
    entity.valueDate = null;
    entity.valueSelect = null;

    const value = fieldValue.getValue();
    switch (fieldValue.fieldDefinition.fieldType) {
      case 'TEXT':
        entity.valueText = value as string;
        break;
      case 'NUMBER':
        entity.valueNumber = value as number;
        break;
      case 'DATE':
        entity.valueDate = value as Date;
        break;
      case 'SELECT':
        entity.valueSelect = value as string;
        break;
    }

    return entity;
  }

  /**
   * Entity에서 타입에 맞는 값 추출
   */
  private static extractValueFromEntity(
    entity: CustomFieldValueEntity,
    fieldType: FieldType,
  ): string | number | Date | null {
    switch (fieldType) {
      case 'TEXT':
        return entity.valueText;
      case 'NUMBER':
        return entity.valueNumber;
      case 'DATE':
        return entity.valueDate;
      case 'SELECT':
        return entity.valueSelect;
      default:
        return null;
    }
  }
}
