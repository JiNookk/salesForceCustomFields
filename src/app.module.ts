import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomFieldModule } from './customField.module';
import { ContactModule } from './contact.module';
import { ElasticsearchModule } from './infrastructure/elasticsearch/elasticsearch.module';
import { CustomFieldDefinitionEntity } from './infrastructure/persistence/typeorm/entity/customFieldDefinition.entity';
import { ContactEntity } from './infrastructure/persistence/typeorm/entity/contact.entity';
import { CustomFieldValueEntity } from './infrastructure/persistence/typeorm/entity/customFieldValue.entity';

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
        CustomFieldDefinitionEntity,
        ContactEntity,
        CustomFieldValueEntity,
      ],
      synchronize: true, // 개발용, 프로덕션에서는 false
      logging: process.env.NODE_ENV !== 'production',
    }),
    ElasticsearchModule,
    CustomFieldModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
