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
   * - ngram analyzer: 인덱싱 시 토큰 분해, 검색 시 standard 사용
   * - 부분 문자열 검색 지원 (.search 서브필드)
   */
  private async createContactsIndex(): Promise<void> {
    await this.client.indices.create({
      index: CONTACTS_INDEX,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        'index.max_ngram_diff': 8,
        analysis: {
          analyzer: {
            ngram_analyzer: {
              type: 'custom',
              tokenizer: 'ngram_tokenizer',
              filter: ['lowercase'],
            },
          },
          tokenizer: {
            ngram_tokenizer: {
              type: 'ngram',
              min_gram: 2,
              max_gram: 10,
              token_chars: ['letter', 'digit'],
            },
          },
        },
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          email: {
            type: 'keyword',
            fields: {
              search: {
                type: 'text',
                analyzer: 'ngram_analyzer',
                search_analyzer: 'standard', // 검색어는 분해하지 않음
              },
            },
          },
          name: {
            type: 'keyword',
            fields: {
              search: {
                type: 'text',
                analyzer: 'ngram_analyzer',
                search_analyzer: 'standard',
              },
            },
          },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          customFields: {
            type: 'object',
            dynamic: 'true',
            properties: {
              job_title__c: {
                type: 'keyword',
                fields: {
                  search: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'standard',
                  },
                },
              },
              department__c: {
                type: 'keyword',
                fields: {
                  search: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'standard',
                  },
                },
              },
              region__c: {
                type: 'keyword',
                fields: {
                  search: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'standard',
                  },
                },
              },
              tier__c: {
                type: 'keyword',
                fields: {
                  search: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'standard',
                  },
                },
              },
              lead_source__c: {
                type: 'keyword',
                fields: {
                  search: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'standard',
                  },
                },
              },
              notes__c: {
                type: 'keyword',
                fields: {
                  search: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'standard',
                  },
                },
              },
              score__c: { type: 'integer' },
              annual_revenue__c: { type: 'long' },
              contract_start__c: { type: 'date' },
              last_contact_date__c: { type: 'date' },
            },
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

    // 키워드 검색 (.search 서브필드 사용 - ngram 분석기 적용)
    // 텍스트 검색 가능한 필드만 명시 (날짜/숫자 필드 제외)
    if (keyword) {
      must.push({
        multi_match: {
          query: keyword,
          fields: [
            'email.search',
            'name.search',
            'customFields.job_title__c.search',
            'customFields.department__c.search',
            'customFields.region__c.search',
            'customFields.tier__c.search',
            'customFields.lead_source__c.search',
            'customFields.notes__c.search',
          ],
          type: 'best_fields',
        },
      });
    }

    // 필터 조건 (email, name은 이미 keyword 타입)
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (field.endsWith('__c')) {
          // 커스텀 필드 필터
          filter.push({
            term: { [`customFields.${field}`]: value },
          });
        } else {
          // 기본 필드 필터
          filter.push({
            term: { [field]: value },
          });
        }
      }
    }

    // 정렬: 검색어가 있으면 relevance(_score) 우선, 없으면 createdAt
    const sortArray: any[] = [];
    if (sort) {
      for (const [field, order] of Object.entries(sort)) {
        if (field.endsWith('__c')) {
          sortArray.push({ [`customFields.${field}`]: order });
        } else {
          sortArray.push({ [field]: order });
        }
      }
    } else if (keyword) {
      // 검색어가 있으면 관련성 순 정렬
      sortArray.push({ _score: 'desc' });
      sortArray.push({ createdAt: 'desc' }); // 동점 시 최신순
    } else {
      sortArray.push({ createdAt: 'desc' });
    }

    const from = (page - 1) * size;

    const response = await this.client.search<ContactDocument>({
      index: CONTACTS_INDEX,
      track_total_hits: true,
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
      data: hits.map((hit) => hit._source as ContactDocument),
      total,
      page,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    };
  }

  /**
   * Contact 고급 검색 (다양한 필터 연산자 지원)
   */
  async searchContactsAdvanced(
    query: AdvancedSearchQuery,
  ): Promise<SearchResult> {
    const { keyword, filterConditions, sort, page = 1, size = 20 } = query;

    const must: any[] = [];
    const filter: any[] = [];

    // 키워드 검색 (.search 서브필드 사용 - ngram 분석기 적용)
    // 텍스트 검색 가능한 필드만 명시 (날짜/숫자 필드 제외)
    if (keyword) {
      must.push({
        multi_match: {
          query: keyword,
          fields: [
            'email.search',
            'name.search',
            'customFields.job_title__c.search',
            'customFields.department__c.search',
            'customFields.region__c.search',
            'customFields.tier__c.search',
            'customFields.lead_source__c.search',
            'customFields.notes__c.search',
          ],
          type: 'best_fields',
        },
      });
    }

    // 필터 조건 (다양한 연산자 지원, email/name은 이미 keyword 타입)
    if (filterConditions) {
      for (const cond of filterConditions) {
        const fieldPath = cond.field.endsWith('__c')
          ? `customFields.${cond.field}`
          : cond.field;

        switch (cond.operator) {
          case 'eq':
            filter.push({ term: { [fieldPath]: cond.value } });
            break;
          case 'contains':
            filter.push({
              wildcard: { [fieldPath]: `*${String(cond.value)}*` },
            });
            break;
          case 'gt':
            filter.push({ range: { [fieldPath]: { gt: cond.value } } });
            break;
          case 'lt':
            filter.push({ range: { [fieldPath]: { lt: cond.value } } });
            break;
          case 'gte':
            filter.push({ range: { [fieldPath]: { gte: cond.value } } });
            break;
          case 'lte':
            filter.push({ range: { [fieldPath]: { lte: cond.value } } });
            break;
          case 'between':
            if (Array.isArray(cond.value) && cond.value.length === 2) {
              filter.push({
                range: {
                  [fieldPath]: { gte: cond.value[0], lte: cond.value[1] },
                },
              });
            }
            break;
        }
      }
    }

    // 정렬: 검색어가 있으면 relevance(_score) 우선, 없으면 createdAt
    const sortArray: any[] = [];
    if (sort) {
      for (const [field, order] of Object.entries(sort)) {
        if (field.endsWith('__c')) {
          sortArray.push({ [`customFields.${field}`]: order });
        } else {
          sortArray.push({ [field]: order });
        }
      }
    } else if (keyword) {
      // 검색어가 있으면 관련성 순 정렬
      sortArray.push({ _score: 'desc' });
      sortArray.push({ createdAt: 'desc' }); // 동점 시 최신순
    } else {
      sortArray.push({ createdAt: 'desc' });
    }

    const from = (page - 1) * size;

    const response = await this.client.search<ContactDocument>({
      index: CONTACTS_INDEX,
      track_total_hits: true,
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
      data: hits.map((hit) => hit._source as ContactDocument),
      total,
      page,
      pageSize: size,
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
    // 커스텀 필드는 이미 keyword 타입, 기본 필드는 .keyword 서브필드 사용
    const fieldPath = field.endsWith('__c')
      ? `customFields.${field}`
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
 * 고급 필터 조건
 */
export interface EsFilterCondition {
  field: string;
  operator: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'between';
  value: string | number | [number, number];
}

/**
 * 고급 검색 쿼리 (다양한 필터 연산자 지원)
 */
export interface AdvancedSearchQuery {
  keyword?: string;
  filterConditions?: EsFilterCondition[];
  sort?: Record<string, 'asc' | 'desc'>;
  page?: number;
  size?: number;
}

/**
 * 검색 결과
 */
export interface SearchResult {
  data: ContactDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 집계 결과
 */
export interface AggregationResult {
  key: string;
  count: number;
}
