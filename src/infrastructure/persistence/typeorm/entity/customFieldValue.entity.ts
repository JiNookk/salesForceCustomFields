import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { ContactEntity } from './contact.entity';
import { CustomFieldDefinitionEntity } from './customFieldDefinition.entity';

/**
 * CustomFieldValue TypeORM Entity
 * EAV 패턴으로 커스텀 필드 값 저장
 */
@Entity('custom_field_values')
@Unique('uk_contact_field', ['contactId', 'fieldDefinitionId'])
export class CustomFieldValueEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'contact_id', type: 'varchar', length: 36 })
  contactId: string;

  @Column({ name: 'field_definition_id', type: 'varchar', length: 36 })
  fieldDefinitionId: string;

  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText: string | null;

  @Column({
    name: 'value_number',
    type: 'decimal',
    precision: 20,
    scale: 6,
    nullable: true,
  })
  valueNumber: number | null;

  @Column({ name: 'value_date', type: 'date', nullable: true })
  valueDate: Date | null;

  @Column({
    name: 'value_select',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  valueSelect: string | null;

  @ManyToOne(() => ContactEntity, (contact) => contact.customFieldValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contact_id' })
  contact: ContactEntity;

  @ManyToOne(() => CustomFieldDefinitionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'field_definition_id' })
  fieldDefinition: CustomFieldDefinitionEntity;
}
