import { Module, Global } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ElasticsearchService } from './elasticsearch.service';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.constants';

@Global()
@Module({
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      useFactory: () => {
        return new Client({
          node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        });
      },
    },
    ElasticsearchService,
  ],
  exports: [ELASTICSEARCH_CLIENT, ElasticsearchService],
})
export class ElasticsearchModule {}
