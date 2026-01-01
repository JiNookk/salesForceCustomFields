import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReindexService } from './application/reindex/reindex.service';
import { ReindexController } from './interface/http/admin/reindex.controller';
import { ContactEntity } from './infrastructure/persistence/typeorm/entity/contact.entity';
import { CustomFieldValueEntity } from './infrastructure/persistence/typeorm/entity/customFieldValue.entity';
import { CustomFieldDefinitionEntity } from './infrastructure/persistence/typeorm/entity/customFieldDefinition.entity';
import { ContactRepository } from './infrastructure/persistence/typeorm/repository/contact.repository';
import { CONTACT_REPOSITORY } from './application/contact/port/contact.repository.port';
import { CustomFieldModule } from './customField.module';

/**
 * Admin 모듈
 * - 재인덱싱 API
 * - Queue 모니터링
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContactEntity,
      CustomFieldValueEntity,
      CustomFieldDefinitionEntity,
    ]),
    CustomFieldModule,
  ],
  controllers: [ReindexController],
  providers: [
    ReindexService,
    {
      provide: CONTACT_REPOSITORY,
      useClass: ContactRepository,
    },
  ],
})
export class AdminModule {}
