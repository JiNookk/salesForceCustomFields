/**
 * 100만 건 시딩 스크립트
 * EAV 패턴 vs ES 성능 비교용 데이터 생성
 *
 * 테이블 구조 (현재 DB):
 *   - contacts: 고객 (id, email, first_name, last_name, phone, status)
 *   - custom_field_definitions: 커스텀 필드 정의
 *   - custom_field_values: 커스텀 필드 값 (EAV, 타입별 컬럼)
 *
 * 사용법:
 *   npx ts-node scripts/seed.ts [options]
 *
 * 옵션:
 *   --contacts=N     Contact 수 (기본: 1000000)
 *   --batch=N        배치 크기 (기본: 5000)
 *   --skip-es        ES 동기화 스킵
 *   --es-only        ES 동기화만 실행 (MySQL 시딩 스킵)
 */

import { faker } from '@faker-js/faker/locale/ko';
import { DataSource } from 'typeorm';
import { Client } from '@elastic/elasticsearch';
import { v4 as uuidv4 } from 'uuid';

// 타입 정의
interface FieldDefRow {
  id: string;
  api_name: string;
  field_type: string;
}

interface CountRow {
  cnt: string;
}

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  custom_fields_raw: string | null;
}

// 설정
const CONFIG = {
  CONTACTS_COUNT: parseInt(
    process.argv.find((a) => a.startsWith('--contacts='))?.split('=')[1] ||
      '1000000',
    10,
  ),
  BATCH_SIZE: parseInt(
    process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1] || '5000',
    10,
  ),
  SKIP_ES: process.argv.includes('--skip-es'),
  ES_ONLY: process.argv.includes('--es-only'),
};

// 커스텀 필드 정의 (현재 DB 구조에 맞춤)
// field_type: TEXT, NUMBER, DATE, SELECT (ENUM)
const FIELD_DEFINITIONS: Array<{
  name: string;
  apiName: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT';
  options: string[] | null;
}> = [
  {
    name: 'Department',
    apiName: 'department__c',
    fieldType: 'SELECT',
    options: [
      'Sales',
      'Marketing',
      'Engineering',
      'HR',
      'Finance',
      'Operations',
    ],
  },
  {
    name: 'Job Title',
    apiName: 'job_title__c',
    fieldType: 'SELECT',
    options: ['Intern', 'Associate', 'Manager', 'Director', 'VP', 'C-Level'],
  },
  {
    name: 'Annual Revenue',
    apiName: 'annual_revenue__c',
    fieldType: 'NUMBER',
    options: null,
  },
  {
    name: 'Contract Start',
    apiName: 'contract_start__c',
    fieldType: 'DATE',
    options: null,
  },
  {
    name: 'Lead Source',
    apiName: 'lead_source__c',
    fieldType: 'SELECT',
    options: ['Web', 'Referral', 'Event', 'Cold Call', 'Partner'],
  },
  {
    name: 'Last Contact Date',
    apiName: 'last_contact_date__c',
    fieldType: 'DATE',
    options: null,
  },
  {
    name: 'Score',
    apiName: 'score__c',
    fieldType: 'NUMBER',
    options: null,
  },
  {
    name: 'Notes',
    apiName: 'notes__c',
    fieldType: 'TEXT',
    options: null,
  },
  {
    name: 'Region',
    apiName: 'region__c',
    fieldType: 'SELECT',
    options: ['APAC', 'EMEA', 'Americas'],
  },
  {
    name: 'Tier',
    apiName: 'tier__c',
    fieldType: 'SELECT',
    options: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
  },
];

// 데이터 소스 생성
function createDataSource(): DataSource {
  return new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3307', 10),
    username: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || 'app123',
    database: process.env.DB_NAME || 'custom_fields',
    logging: false,
    extra: {
      connectionLimit: 10,
    },
  });
}

// ES 클라이언트 생성
function createEsClient(): Client {
  return new Client({
    node: process.env.ES_NODE || 'http://localhost:9200',
  });
}

// 진행률 표시
function showProgress(current: number, total: number, label: string): void {
  const percent = Math.round((current / total) * 100);
  const bar =
    '█'.repeat(Math.floor(percent / 2)) +
    '░'.repeat(50 - Math.floor(percent / 2));
  process.stdout.write(
    `\r${label}: [${bar}] ${percent}% (${current.toLocaleString()}/${total.toLocaleString()})`,
  );
}

// 커스텀 필드 정의 시딩
async function seedFieldDefinitions(
  dataSource: DataSource,
): Promise<Map<string, { id: string; fieldType: string }>> {
  console.log('\n📦 필드 정의 시딩...');

  const fieldIdMap = new Map<string, { id: string; fieldType: string }>();

  for (let i = 0; i < FIELD_DEFINITIONS.length; i++) {
    const def = FIELD_DEFINITIONS[i];
    const id = uuidv4();

    await dataSource.query(
      `INSERT INTO custom_field_definitions (id, name, api_name, field_type, options, is_required, is_active, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), field_type = VALUES(field_type), options = VALUES(options)`,
      [
        id,
        def.name,
        def.apiName,
        def.fieldType,
        def.options ? JSON.stringify(def.options) : null,
        false,
        true,
        i,
      ],
    );
  }

  // 기존 필드 ID 조회 (이미 존재하는 경우)
  const existing: FieldDefRow[] = await dataSource.query(
    'SELECT id, api_name, field_type FROM custom_field_definitions',
  );
  for (const row of existing) {
    fieldIdMap.set(row.api_name, { id: row.id, fieldType: row.field_type });
  }

  console.log(`  ✅ ${FIELD_DEFINITIONS.length}개 필드 정의 완료`);
  return fieldIdMap;
}

// 랜덤 커스텀 필드 값 생성 (타입별 컬럼용)
function generateFieldValue(def: (typeof FIELD_DEFINITIONS)[0]): {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueSelect: string | null;
} {
  const result = {
    valueText: null as string | null,
    valueNumber: null as number | null,
    valueDate: null as string | null,
    valueSelect: null as string | null,
  };

  switch (def.fieldType) {
    case 'SELECT':
      result.valueSelect = faker.helpers.arrayElement(def.options!);
      break;
    case 'NUMBER':
      if (def.apiName === 'score__c') {
        result.valueNumber = faker.number.int({ min: 0, max: 100 });
      } else {
        result.valueNumber = faker.number.int({ min: 10000, max: 100000000 });
      }
      break;
    case 'DATE':
      result.valueDate = faker.date
        .past({ years: 3 })
        .toISOString()
        .split('T')[0];
      break;
    case 'TEXT':
      result.valueText = faker.lorem.sentence();
      break;
  }

  return result;
}

// Contact + Custom Field Values 배치 시딩
async function seedContacts(
  dataSource: DataSource,
  fieldIdMap: Map<string, { id: string; fieldType: string }>,
): Promise<void> {
  console.log(
    `\n👥 Contact 시딩 시작 (${CONFIG.CONTACTS_COUNT.toLocaleString()}건)...`,
  );

  const startTime = Date.now();

  for (
    let offset = 0;
    offset < CONFIG.CONTACTS_COUNT;
    offset += CONFIG.BATCH_SIZE
  ) {
    const batchSize = Math.min(
      CONFIG.BATCH_SIZE,
      CONFIG.CONTACTS_COUNT - offset,
    );

    // Contact 데이터 생성
    const contacts: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      status: 'active' | 'inactive';
    }> = [];

    const fieldValues: Array<{
      id: string;
      contactId: string;
      fieldDefinitionId: string;
      valueText: string | null;
      valueNumber: number | null;
      valueDate: string | null;
      valueSelect: string | null;
    }> = [];

    for (let i = 0; i < batchSize; i++) {
      const contactId = uuidv4();
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      contacts.push({
        id: contactId,
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        status: faker.helpers.arrayElement(['active', 'inactive']),
      });

      // 각 Contact에 대해 모든 커스텀 필드 값 생성
      for (const def of FIELD_DEFINITIONS) {
        const fieldInfo = fieldIdMap.get(def.apiName);
        if (!fieldInfo) continue;

        const values = generateFieldValue(def);

        fieldValues.push({
          id: uuidv4(),
          contactId,
          fieldDefinitionId: fieldInfo.id,
          ...values,
        });
      }
    }

    // Contact 배치 삽입
    if (contacts.length > 0) {
      const placeholders = contacts
        .map(() => '(?, ?, ?, ?, ?, NOW(), NOW())')
        .join(', ');
      const values = contacts.flatMap((c) => [
        c.id,
        c.email,
        c.firstName,
        c.lastName,
        c.status,
      ]);
      await dataSource.query(
        `INSERT INTO contacts (id, email, first_name, last_name, status, created_at, updated_at) VALUES ${placeholders}`,
        values,
      );
    }

    // Field Values 배치 삽입 (청크 분할)
    const FIELD_VALUES_CHUNK = 5000;
    for (
      let fvOffset = 0;
      fvOffset < fieldValues.length;
      fvOffset += FIELD_VALUES_CHUNK
    ) {
      const chunk = fieldValues.slice(fvOffset, fvOffset + FIELD_VALUES_CHUNK);
      const fvPlaceholders = chunk
        .map(() => '(?, ?, ?, ?, ?, ?, ?)')
        .join(', ');
      const fvValues = chunk.flatMap((fv) => [
        fv.id,
        fv.contactId,
        fv.fieldDefinitionId,
        fv.valueText,
        fv.valueNumber,
        fv.valueDate,
        fv.valueSelect,
      ]);
      await dataSource.query(
        `INSERT INTO custom_field_values (id, contact_id, field_definition_id, value_text, value_number, value_date, value_select) VALUES ${fvPlaceholders}`,
        fvValues,
      );
    }

    showProgress(offset + batchSize, CONFIG.CONTACTS_COUNT, '  MySQL');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✅ MySQL 시딩 완료 (${elapsed}초)`);
}

// ES 인덱스 생성
async function createEsIndex(esClient: Client): Promise<void> {
  console.log('\n🔍 ES 인덱스 생성...');

  const indexExists = await esClient.indices.exists({ index: 'contacts' });
  if (indexExists) {
    console.log('  ⚠️  기존 인덱스 삭제 중...');
    await esClient.indices.delete({ index: 'contacts' });
  }

  await esClient.indices.create({
    index: 'contacts',
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      refresh_interval: '-1', // 벌크 인덱싱 중 리프레시 비활성화
      analysis: {
        tokenizer: {
          ngram_tokenizer: {
            type: 'ngram' as const,
            min_gram: 2,
            max_gram: 3,
            token_chars: ['letter', 'digit'] as const,
          },
        },
        analyzer: {
          ngram_analyzer: {
            type: 'custom' as const,
            tokenizer: 'ngram_tokenizer',
            filter: ['lowercase'],
          },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        name: {
          type: 'keyword',
          fields: {
            search: { type: 'text', analyzer: 'ngram_analyzer' },
          },
        },
        email: {
          type: 'keyword',
          fields: {
            search: { type: 'text', analyzer: 'ngram_analyzer' },
          },
        },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        customFields: {
          properties: {
            department__c: {
              type: 'keyword',
              fields: { search: { type: 'text', analyzer: 'ngram_analyzer' } },
            },
            job_title__c: {
              type: 'keyword',
              fields: { search: { type: 'text', analyzer: 'ngram_analyzer' } },
            },
            annual_revenue__c: { type: 'long' },
            contract_start__c: { type: 'date' },
            lead_source__c: {
              type: 'keyword',
              fields: { search: { type: 'text', analyzer: 'ngram_analyzer' } },
            },
            last_contact_date__c: { type: 'date' },
            score__c: { type: 'integer' },
            notes__c: {
              type: 'text',
              analyzer: 'ngram_analyzer',
              fields: { keyword: { type: 'keyword', ignore_above: 256 } },
            },
            region__c: {
              type: 'keyword',
              fields: { search: { type: 'text', analyzer: 'ngram_analyzer' } },
            },
            tier__c: {
              type: 'keyword',
              fields: { search: { type: 'text', analyzer: 'ngram_analyzer' } },
            },
          },
        },
      },
    },
  });

  console.log('  ✅ ES 인덱스 생성 완료');
}

// ES 동기화
async function syncToEs(
  dataSource: DataSource,
  esClient: Client,
): Promise<void> {
  console.log(`\n🔄 ES 동기화 시작...`);

  // 전체 Contact 수 조회
  const countResult: CountRow[] = await dataSource.query(
    'SELECT COUNT(*) as cnt FROM contacts',
  );
  const totalContacts = parseInt(countResult[0].cnt, 10);

  console.log(`  총 ${totalContacts.toLocaleString()}건 동기화 예정`);

  const startTime = Date.now();
  const ES_BATCH = 2000;

  for (let offset = 0; offset < totalContacts; offset += ES_BATCH) {
    // Contact + 커스텀 필드 값 조회 (현재 테이블 구조)
    const contacts: ContactRow[] = await dataSource.query(
      `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.created_at as createdAt,
        c.updated_at as updatedAt,
        GROUP_CONCAT(
          CONCAT(
            cfd.api_name, ':',
            cfd.field_type, ':',
            COALESCE(cfv.value_text, ''), '|',
            COALESCE(cfv.value_number, ''), '|',
            COALESCE(cfv.value_date, ''), '|',
            COALESCE(cfv.value_select, '')
          )
          SEPARATOR '||'
        ) as custom_fields_raw
      FROM contacts c
      LEFT JOIN custom_field_values cfv ON cfv.contact_id = c.id
      LEFT JOIN custom_field_definitions cfd ON cfd.id = cfv.field_definition_id
      GROUP BY c.id
      LIMIT ?, ?
    `,
      [offset, ES_BATCH],
    );

    if (contacts.length === 0) break;

    // ES 벌크 요청 구성
    const operations = contacts.flatMap((contact: ContactRow) => {
      const customFields: Record<string, string | number | null> = {};

      if (contact.custom_fields_raw) {
        const entries = contact.custom_fields_raw.split('||');
        for (const entry of entries) {
          // 형식: apiName:fieldType:valueText|valueNumber|valueDate|valueSelect
          const colonIdx = entry.indexOf(':');
          const secondColonIdx = entry.indexOf(':', colonIdx + 1);
          if (colonIdx > 0 && secondColonIdx > colonIdx) {
            const apiName = entry.substring(0, colonIdx);
            const fieldType = entry.substring(colonIdx + 1, secondColonIdx);
            const valuesStr = entry.substring(secondColonIdx + 1);
            const [valueText, valueNumber, valueDate, valueSelect] =
              valuesStr.split('|');

            let value: string | number | null = null;
            switch (fieldType) {
              case 'TEXT':
                value = valueText || null;
                break;
              case 'NUMBER':
                value = valueNumber ? parseFloat(valueNumber) : null;
                break;
              case 'DATE':
                value = valueDate || null;
                break;
              case 'SELECT':
                value = valueSelect || null;
                break;
            }

            if (value !== null) {
              customFields[apiName] = value;
            }
          }
        }
      }

      return [
        { index: { _index: 'contacts', _id: contact.id } },
        {
          id: contact.id,
          name: `${contact.first_name} ${contact.last_name}`,
          email: contact.email,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
          customFields,
        },
      ];
    });

    await esClient.bulk({ operations, refresh: false });
    showProgress(
      Math.min(offset + ES_BATCH, totalContacts),
      totalContacts,
      '  ES Bulk',
    );
  }

  // 리프레시 활성화 및 실행
  console.log('\n  리프레시 중...');
  await esClient.indices.putSettings({
    index: 'contacts',
    settings: { refresh_interval: '1s' },
  });
  await esClient.indices.refresh({ index: 'contacts' });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  ✅ ES 동기화 완료 (${elapsed}초)`);
}

// 메인 함수
async function main(): Promise<void> {
  console.log('🚀 시딩 스크립트 시작');
  console.log(`   - Contacts: ${CONFIG.CONTACTS_COUNT.toLocaleString()}건`);
  console.log(`   - Batch Size: ${CONFIG.BATCH_SIZE.toLocaleString()}`);
  console.log(`   - Skip ES: ${CONFIG.SKIP_ES}`);
  console.log(`   - ES Only: ${CONFIG.ES_ONLY}`);

  const dataSource = createDataSource();
  const esClient = createEsClient();

  try {
    await dataSource.initialize();
    console.log('\n✅ MySQL 연결 성공');

    if (!CONFIG.ES_ONLY) {
      // 기존 데이터 삭제
      console.log('\n🗑️  기존 데이터 삭제...');
      await dataSource.query('DELETE FROM custom_field_values');
      await dataSource.query('DELETE FROM contacts');
      await dataSource.query('DELETE FROM custom_field_definitions');
      console.log('  ✅ 기존 데이터 삭제 완료');

      // 필드 정의 시딩
      const fieldIdMap = await seedFieldDefinitions(dataSource);

      // Contact 시딩
      await seedContacts(dataSource, fieldIdMap);
    }

    if (!CONFIG.SKIP_ES) {
      // ES 인덱스 생성 및 동기화
      await createEsIndex(esClient);
      await syncToEs(dataSource, esClient);
    }

    // 결과 요약
    console.log('\n📊 시딩 완료 요약:');

    const contactCount: CountRow[] = await dataSource.query(
      'SELECT COUNT(*) as cnt FROM contacts',
    );
    const defCount: CountRow[] = await dataSource.query(
      'SELECT COUNT(*) as cnt FROM custom_field_definitions',
    );
    const fieldValueCount: CountRow[] = await dataSource.query(
      'SELECT COUNT(*) as cnt FROM custom_field_values',
    );

    console.log(
      `   - Contacts: ${parseInt(contactCount[0].cnt, 10).toLocaleString()}건`,
    );
    console.log(
      `   - Field Definitions: ${parseInt(defCount[0].cnt, 10).toLocaleString()}건`,
    );
    console.log(
      `   - Field Values: ${parseInt(fieldValueCount[0].cnt, 10).toLocaleString()}건`,
    );

    if (!CONFIG.SKIP_ES) {
      const esCount = await esClient.count({ index: 'contacts' });
      console.log(`   - ES Documents: ${esCount.count.toLocaleString()}건`);
    }
  } catch (error) {
    console.error('\n❌ 에러 발생:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('\n👋 완료!');
  }
}

void main();
