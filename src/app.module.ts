import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomFieldModule } from './customField.module';
import { ContactModule } from './contact.module';
import { AdminModule } from './admin.module';
import { ElasticsearchModule } from './infrastructure/elasticsearch/elasticsearch.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { AccountEntity } from './infrastructure/persistence/typeorm/entity/account.entity';
import { ContactEntity } from './infrastructure/persistence/typeorm/entity/contact.entity';
import { FieldDefinitionEntity } from './infrastructure/persistence/typeorm/entity/fieldDefinition.entity';
import { FieldValueEntity } from './infrastructure/persistence/typeorm/entity/fieldValue.entity';
import { OutboxEntity } from './infrastructure/persistence/typeorm/entity/outbox.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307', 10),
      username: process.env.DB_USERNAME || 'app',
      password: process.env.DB_PASSWORD || 'app123',
      database: process.env.DB_DATABASE || 'custom_fields',
      entities: [
        AccountEntity,
        ContactEntity,
        FieldDefinitionEntity,
        FieldValueEntity,
        OutboxEntity,
      ],
      synchronize: true, // 개발용, 프로덕션에서는 false
      logging: false,
    }),
    ElasticsearchModule,
    QueueModule,
    OutboxModule,
    CustomFieldModule,
    ContactModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
