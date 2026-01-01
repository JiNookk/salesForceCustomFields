import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { ELASTICSEARCH_CLIENT } from './elasticsearch.constants';

const CONTACTS_INDEX = 'contacts';

/**
 * Elasticsearch 서비스
 * - 인덱스 관리
 * - 문서 CRUD
 * - 검색
 */
@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);

  constructor(
    @Inject(ELASTICSEARCH_CLIENT)
    private readonly client: Client,
  ) {}

  async onModuleInit() {
    await this.ensureIndexExists();
  }

  /**
   * contacts 인덱스 존재 확인 및 생성
   */
  private async ensureIndexExists(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: CONTACTS_INDEX,
      });

      if (!exists) {
        await this.createContactsIndex();
        this.logger.log(`Index '${CONTACTS_INDEX}' created`);
      } else {
        this.logger.log(`Index '${CONTACTS_INDEX}' already exists`);
      }
    } catch (error) {
      this.logger.error(`Failed to check/create index: ${error}`);
    }
  }

  /**
   * contacts 인덱스 생성
   * - 기본 필드: id, email, name, createdAt, updatedAt
   * - 커스텀 필드: customFields.* (동적 매핑)
   */
  private async createContactsIndex(): Promise<void> {
    await this.client.indices.create({
      index: CONTACTS_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          email: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          name: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          customFields: {
            type: 'object',
            dynamic: true,
          },
        },
      },
    });
  }

  /**
   * Contact 문서 인덱싱 (생성/수정)
   */
  async indexContact(contact: ContactDocument): Promise<void> {
    await this.client.index({
      index: CONTACTS_INDEX,
      id: contact.id,
      document: contact,
      refresh: true,
    });
    this.logger.debug(`Indexed contact: ${contact.id}`);
  }

  /**
   * Contact 문서 삭제
   */
  async deleteContact(contactId: string): Promise<void> {
    try {
      await this.client.delete({
        index: CONTACTS_INDEX,
        id: contactId,
        refresh: true,
      });
      this.logger.debug(`Deleted contact from index: ${contactId}`);
    } catch (error: unknown) {
      const esError = error as { meta?: { statusCode?: number } };
      if (esError?.meta?.statusCode === 404) {
        this.logger.warn(`Contact not found in index: ${contactId}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Contact 검색
   */
  async searchContacts(query: SearchQuery): Promise<SearchResult> {
    const { keyword, filters, sort, page = 1, size = 20 } = query;

    const must: any[] = [];
    const filter: any[] = [];

    // 키워드 검색 (email, name에서 검색, date 필드 제외)
    if (keyword) {
      must.push({
        multi_match: {
          query: keyword,
          fields: ['email', 'name'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // 필터 조건
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (field.endsWith('__c')) {
          // 커스텀 필드 필터 (text 필드는 .keyword 사용)
          filter.push({
            term: { [`customFields.${field}.keyword`]: value },
          });
        } else {
          // 기본 필드 필터
          filter.push({
            term: { [`${field}.keyword`]: value },
          });
        }
      }
    }

    // 정렬
    const sortArray: any[] = [];
    if (sort) {
      for (const [field, order] of Object.entries(sort)) {
        if (field.endsWith('__c')) {
          // 커스텀 필드 정렬 (text 필드는 .keyword 사용)
          sortArray.push({ [`customFields.${field}.keyword`]: order });
        } else if (field === 'createdAt' || field === 'updatedAt') {
          sortArray.push({ [field]: order });
        } else {
          sortArray.push({ [`${field}.keyword`]: order });
        }
      }
    } else {
      sortArray.push({ createdAt: 'desc' });
    }

    const from = (page - 1) * size;

    const response = await this.client.search<ContactDocument>({
      index: CONTACTS_INDEX,
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: sortArray,
      from,
      size,
    });

    const hits = response.hits.hits;
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    return {
      items: hits.map((hit) => hit._source as ContactDocument),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    };
  }

  /**
   * 집계 (그루핑)
   */
  async aggregateContacts(
    field: string,
    aggregationSize = 10,
  ): Promise<AggregationResult[]> {
    // 커스텀 필드와 기본 필드 모두 .keyword 사용
    const fieldPath = field.endsWith('__c')
      ? `customFields.${field}.keyword`
      : `${field}.keyword`;

    const response = await this.client.search({
      index: CONTACTS_INDEX,
      size: 0,
      aggs: {
        group_by_field: {
          terms: {
            field: fieldPath,
            size: aggregationSize,
          },
        },
      },
    });

    interface AggregationBucket {
      key: string;
      doc_count: number;
    }

    interface TermsAggregation {
      buckets: AggregationBucket[];
    }

    const aggregation = response.aggregations?.group_by_field as
      | TermsAggregation
      | undefined;
    const buckets = aggregation?.buckets ?? [];

    return buckets.map((bucket) => ({
      key: bucket.key,
      count: bucket.doc_count,
    }));
  }
}

/**
 * ES에 저장할 Contact 문서 형태
 */
export interface ContactDocument {
  id: string;
  email: string;
  name: string;
  customFields: Record<string, string | number | Date | null>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 검색 쿼리
 */
export interface SearchQuery {
  keyword?: string;
  filters?: Record<string, string | number>;
  sort?: Record<string, 'asc' | 'desc'>;
  page?: number;
  size?: number;
}

/**
 * 검색 결과
 */
export interface SearchResult {
  items: ContactDocument[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * 집계 결과
 */
export interface AggregationResult {
  key: string;
  count: number;
}
