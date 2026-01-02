import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReindexService } from './application/reindex/reindex.service';
import { ReindexController } from './interface/http/admin/reindex.controller';
import { AccountEntity } from './infrastructure/persistence/typeorm/entity/account.entity';
import { ContactEntity } from './infrastructure/persistence/typeorm/entity/contact.entity';
import { FieldValueEntity } from './infrastructure/persistence/typeorm/entity/fieldValue.entity';
import { FieldDefinitionEntity } from './infrastructure/persistence/typeorm/entity/fieldDefinition.entity';
import { ContactRepository } from './infrastructure/persistence/typeorm/repository/contact.repository';
import { CONTACT_REPOSITORY } from './application/contact/port/contact.repository.port';
import { CustomFieldModule } from './customField.module';
import { QueueModule } from './infrastructure/queue/queue.module';

/**
 * Admin 모듈
 * - 재인덱싱 API
 * - Queue 모니터링
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      ContactEntity,
      FieldValueEntity,
      FieldDefinitionEntity,
    ]),
    CustomFieldModule,
    QueueModule,
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
