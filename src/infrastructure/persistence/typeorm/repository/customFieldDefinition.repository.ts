import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomFieldDefinition } from '../../../../domain/customField/customFieldDefinition.domain';
import { CustomFieldDefinitionRepositoryPort } from '../../../../application/customField/port/customFieldDefinition.repository.port';
import { CustomFieldDefinitionEntity } from '../entity/customFieldDefinition.entity';
import { CustomFieldDefinitionMapper } from '../mapper/customFieldDefinition.mapper';

/**
 * CustomFieldDefinition Repository 구현
 */
@Injectable()
export class CustomFieldDefinitionRepository implements CustomFieldDefinitionRepositoryPort {
  constructor(
    @InjectRepository(CustomFieldDefinitionEntity)
    private readonly repository: Repository<CustomFieldDefinitionEntity>,
  ) {}

  async findById(id: string): Promise<CustomFieldDefinition | null> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) return null;
    return CustomFieldDefinitionMapper.toDomain(entity);
  }

  async findByApiName(apiName: string): Promise<CustomFieldDefinition | null> {
    const entity = await this.repository.findOne({ where: { apiName } });
    if (!entity) return null;
    return CustomFieldDefinitionMapper.toDomain(entity);
  }

  async findAllActive(): Promise<CustomFieldDefinition[]> {
    const entities = await this.repository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
    return entities.map((entity) =>
      CustomFieldDefinitionMapper.toDomain(entity),
    );
  }

  async save(definition: CustomFieldDefinition): Promise<void> {
    const existingEntity = await this.repository.findOne({
      where: { id: definition.id },
    });

    if (existingEntity) {
      const updatedEntity = CustomFieldDefinitionMapper.updateEntity(
        existingEntity,
        definition,
      );
      await this.repository.save(updatedEntity);
    } else {
      const newEntity = CustomFieldDefinitionMapper.toEntity(definition);
      await this.repository.save(newEntity);
    }
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
