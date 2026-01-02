import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from './infrastructure/persistence/typeorm/entity/account.entity';
import { ContactEntity } from './infrastructure/persistence/typeorm/entity/contact.entity';
import { FieldValueEntity } from './infrastructure/persistence/typeorm/entity/fieldValue.entity';
import { FieldDefinitionEntity } from './infrastructure/persistence/typeorm/entity/fieldDefinition.entity';
import { ContactRepository } from './infrastructure/persistence/typeorm/repository/contact.repository';
import { ContactService } from './application/contact/contact.service';
import { ContactSearchService } from './application/contact/contact-search.service';
import { ContactController } from './interface/http/contact/contact.controller';
import { SearchController } from './interface/http/search/search.controller';
import { CONTACT_REPOSITORY } from './application/contact/port/contact.repository.port';
import { CustomFieldModule } from './customField.module';
import { ElasticsearchModule } from './infrastructure/elasticsearch/elasticsearch.module';
import { QueueModule } from './infrastructure/queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      ContactEntity,
      FieldValueEntity,
      FieldDefinitionEntity,
    ]),
    CustomFieldModule,
    ElasticsearchModule,
    QueueModule,
  ],
  controllers: [SearchController, ContactController],
  providers: [
    ContactService,
    ContactSearchService,
    {
      provide: CONTACT_REPOSITORY,
      useClass: ContactRepository,
    },
  ],
  exports: [ContactService, ContactSearchService],
})
export class ContactModule {}
