# EAV vs Elasticsearch Performance Benchmark

**동적 커스텀 필드 검색에서 MySQL EAV 패턴의 한계를 Elasticsearch로 해결한 성능 최적화 프로젝트**

> 🔗 **Live Demo**: [eav-elasticsearch-benchmark.vercel.app](https://eav-elasticsearch-benchmark.vercel.app)

<br/>

## TL;DR

**50만 건** 데이터 기준, 커스텀 필드 검색에서 **최대 218배 성능 개선** 달성

| 시나리오 | MySQL (EAV) | Elasticsearch | 개선율 |
|----------|-------------|---------------|--------|
| 커스텀 필드 필터 | 1,847ms | 21ms | **88x** |
| 커스텀 필드 정렬 | 3,521ms | 19ms | **185x** |
| 필터 + 정렬 조합 | 5,234ms | 24ms | **218x** |

<br/>

## 핵심 기술 포인트

- **Transactional Outbox Pattern**: MySQL-ES 간 데이터 일관성 보장
- **BullMQ 기반 비동기 동기화**: 평균 ~10ms 내 ES 반영
- **Clean Architecture**: Domain/Application/Infrastructure 레이어 분리
- **EAV → Document 비정규화**: 5.64GB → 312MB (18배 저장 효율)

<br/>

## 문제 정의

### EAV(Entity-Attribute-Value) 패턴의 한계

Salesforce와 같은 SaaS 플랫폼은 사용자가 동적으로 커스텀 필드를 추가할 수 있습니다.
이를 RDBMS에서 구현하는 전통적인 방법은 **EAV 패턴**입니다:

```
┌─────────────────┐       ┌──────────────────────────┐
│ contacts        │       │ custom_field_values      │
├─────────────────┤       ├──────────────────────────┤
│ id              │──────▶│ contact_id (FK)          │
│ email           │       │ field_definition_id (FK) │
│ name            │       │ value                    │
│ created_at      │       └──────────────────────────┘
└─────────────────┘                    │
                                       ▼
                          ┌──────────────────────────┐
                          │ custom_field_definitions │
                          ├──────────────────────────┤
                          │ id                       │
                          │ api_name (tier__c)       │
                          │ field_type               │
                          └──────────────────────────┘
```

**문제점:**

| 작업 | EAV 쿼리 복잡도 | 성능 |
|------|----------------|------|
| 커스텀 필드 검색 | N개의 서브쿼리 필요 | O(N × M) |
| 커스텀 필드 정렬 | PIVOT 쿼리 + GROUP BY | 매우 느림 |
| 집계 (GROUP BY) | 복잡한 CASE WHEN | 매우 느림 |

**50만 건 기준 성능 비교:**

| 작업 | MySQL (EAV) | Elasticsearch |
|------|-------------|---------------|
| 단순 목록 조회 | ~200ms | ~15ms |
| 커스텀 필드 정렬 | ~3,000ms | ~20ms |
| 커스텀 필드 필터 + 정렬 | ~5,000ms+ | ~25ms |

---

## 해결책: Elasticsearch 도입

### 비정규화된 문서 저장

```json
{
  "id": "uuid-1234",
  "email": "john@example.com",
  "name": "John Doe",
  "customFields": {
    "tier__c": "GOLD",
    "score__c": 95,
    "notes__c": "VIP 고객"
  },
  "createdAt": "2024-01-15T09:00:00Z",
  "updatedAt": "2024-01-15T09:00:00Z"
}
```

**장점:**
- 모든 필드가 하나의 문서에 → JOIN 불필요
- 역인덱스(Inverted Index)로 빠른 검색
- 커스텀 필드 정렬/집계가 기본 필드와 동일한 성능

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client (Next.js)                               │
│                   https://eav-elasticsearch-benchmark.vercel.app            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NestJS API Server                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ContactController                           │   │
│  │                                                                     │   │
│  │   GET /search ──┬── dataSource=es ───▶ ElasticsearchService        │   │
│  │                 │                                                   │   │
│  │                 └── dataSource=mysql ─▶ MySQL (EAV) 직접 쿼리      │   │
│  │                                                                     │   │
│  │   POST/PATCH/DELETE ──▶ ContactService                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        ContactService                               │   │
│  │                                                                     │   │
│  │   1. MySQL 트랜잭션 시작                                            │   │
│  │   2. Contact 저장                                                   │   │
│  │   3. Outbox 이벤트 저장 (같은 트랜잭션)                              │   │
│  │   4. 트랜잭션 커밋                                                   │   │
│  │   5. BullMQ에 작업 추가 (best-effort)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       │                               │                               │
       ▼                               ▼                               ▼
┌─────────────┐              ┌─────────────────┐              ┌─────────────┐
│   MySQL     │              │     Redis       │              │ Elasticsearch│
│             │              │                 │              │             │
│ - contacts  │              │ BullMQ Queue    │              │ contacts    │
│ - field_    │              │ (es-sync)       │              │ index       │
│   values    │              │                 │              │             │
│ - outbox    │◀─────────────│                 │─────────────▶│ 비정규화된  │
│             │   Cron이     │                 │   Worker가   │ 문서 저장   │
│             │   PENDING    │                 │   ES 동기화  │             │
│             │   이벤트 처리│                 │              │             │
└─────────────┘              └─────────────────┘              └─────────────┘
```

---

## 데이터 동기화 전략

### Transactional Outbox Pattern + BullMQ

데이터 일관성을 보장하면서 비동기로 ES를 동기화합니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Write Path (쓰기)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │                    MySQL Transaction                             │
     │  ┌────────────────────────────────────────────────────────────┐  │
     │  │  1. Contact INSERT/UPDATE/DELETE                           │  │
     │  │  2. Outbox INSERT (PENDING 상태)                           │  │
     │  │                                                            │  │
     │  │  → 같은 트랜잭션 = 원자성 보장                              │  │
     │  │  → Contact 저장 실패 시 Outbox도 롤백                       │  │
     │  └────────────────────────────────────────────────────────────┘  │
     └──────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │                   Best-Effort Queue                              │
     │  ┌────────────────────────────────────────────────────────────┐  │
     │  │  트랜잭션 커밋 후 BullMQ에 작업 추가 시도                    │  │
     │  │                                                            │  │
     │  │  성공 → Worker가 즉시 ES 동기화 (~10ms)                     │  │
     │  │  실패 → Outbox Cron이 나중에 처리 (~10초 후)                 │  │
     │  └────────────────────────────────────────────────────────────┘  │
     └──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         Background Processors                               │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │  EsSyncProcessor (BullMQ Worker)                                 │
     │  ┌────────────────────────────────────────────────────────────┐  │
     │  │  Queue에서 작업 수신                                        │  │
     │  │  → CONTACT_CREATED: ES 문서 생성                            │  │
     │  │  → CONTACT_UPDATED: ES 문서 업데이트                         │  │
     │  │  → CONTACT_DELETED: ES 문서 삭제                            │  │
     │  │                                                            │  │
     │  │  실패 시 자동 재시도 (BullMQ 내장)                           │  │
     │  └────────────────────────────────────────────────────────────┘  │
     └──────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │  OutboxProcessor (Cron - Fallback)                               │
     │  ┌────────────────────────────────────────────────────────────┐  │
     │  │  @Cron(EVERY_10_SECONDS)                                   │  │
     │  │  → PENDING 상태 이벤트 → Queue에 추가 → DONE 처리           │  │
     │  │                                                            │  │
     │  │  @Cron(EVERY_MINUTE)                                       │  │
     │  │  → FAILED 이벤트 재시도 (최대 5회)                          │  │
     │  │                                                            │  │
     │  │  @Cron(EVERY_DAY_AT_MIDNIGHT)                               │  │
     │  │  → 7일 지난 DONE 이벤트 정리                                │  │
     │  └────────────────────────────────────────────────────────────┘  │
     └──────────────────────────────────────────────────────────────────┘
```

### Outbox 이벤트 상태 흐름

```
PENDING ──┬──▶ PROCESSING ──┬──▶ DONE (성공)
          │                 │
          │                 └──▶ FAILED ──┬──▶ PROCESSING (재시도)
          │                               │
          │                               └──▶ FAILED (최대 5회 후 포기)
          │
          └──▶ (다른 프로세스가 선점)
```

---

## 프로젝트 구조

```
src/
├── domain/                          # 도메인 레이어 (순수 비즈니스 로직)
│   ├── contact/
│   │   └── contact.domain.ts
│   └── customField/
│       ├── customFieldDefinition.domain.ts
│       └── customFieldValue.domain.ts
│
├── application/                     # 애플리케이션 레이어 (유스케이스)
│   ├── contact/
│   │   ├── contact.service.ts       # Contact CRUD + Outbox
│   │   └── contact-search.service.ts # MySQL/ES 검색
│   └── customField/
│       └── customField.service.ts
│
├── infrastructure/                  # 인프라 레이어
│   ├── elasticsearch/
│   │   └── elasticsearch.service.ts # ES 인덱싱/검색
│   ├── queue/
│   │   ├── es-sync.processor.ts     # BullMQ Worker
│   │   └── es-sync.types.ts
│   ├── outbox/
│   │   └── outbox-processor.service.ts # Cron Fallback
│   └── persistence/
│       └── typeorm/
│           ├── entity/
│           │   ├── contact.entity.ts
│           │   ├── fieldDefinition.entity.ts
│           │   ├── fieldValue.entity.ts
│           │   └── outbox.entity.ts
│           └── repository/
│
├── interface/                       # 인터페이스 레이어 (API)
│   └── http/
│       └── contact/
│           └── contact.controller.ts
│
dashboard/                           # Next.js 프론트엔드
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ContactsTable.tsx
│   │   ├── DataSourceToggle.tsx     # MySQL/ES 전환
│   │   └── QueryTimeDisplay.tsx     # 쿼리 시간 표시
│   └── hooks/
│       └── useContacts.ts
```

---

## 기술 스택

**Backend:** NestJS · TypeORM · TypeScript
**Database:** MySQL 8.0 (EAV) · Elasticsearch 8.11
**Queue:** BullMQ · Redis
**Frontend:** Next.js 14 · React Query · TailwindCSS
**Infra:** Docker Compose

---

## 실행 방법

### 1. 인프라 실행

```bash
# Docker Compose로 MySQL, ES, Redis 실행
docker compose up -d

# 상태 확인
docker compose ps
```

### 2. 백엔드 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev
```

### 3. 시드 데이터 생성

```bash
# 기본 (50만 건)
npm run seed:large

# ES만 재생성
npm run seed:es-only

# 소량 테스트 (1만 건)
npm run seed:small
```

### 4. 프론트엔드 실행

```bash
cd dashboard
npm install
npm run dev
```

### 5. 접속

- **Dashboard**: http://localhost:4000
- **API**: http://localhost:3000
- **Kibana**: http://localhost:5601

---

## API 엔드포인트

### Contact 검색

```bash
# Elasticsearch 검색 (빠름)
GET /api/v1/contacts/search?dataSource=es&page=1&pageSize=20

# MySQL 검색 (EAV - 느림)
GET /api/v1/contacts/search?dataSource=mysql&page=1&pageSize=20

# 키워드 검색
GET /api/v1/contacts/search?dataSource=es&search=john

# 커스텀 필드 필터
GET /api/v1/contacts/search?dataSource=es&filter=[{"field":"tier__c","operator":"eq","value":"GOLD"}]

# 커스텀 필드 정렬
GET /api/v1/contacts/search?dataSource=es&sort=[{"field":"score__c","direction":"desc"}]
```

### Contact CRUD

```bash
# 생성
POST /api/v1/contacts
{
  "email": "new@example.com",
  "name": "New User",
  "customFields": {
    "tier__c": "SILVER",
    "score__c": 50
  }
}

# 조회
GET /api/v1/contacts/:id

# 수정
PATCH /api/v1/contacts/:id
{
  "name": "Updated Name",
  "customFields": {
    "tier__c": "GOLD"
  }
}

# 삭제
DELETE /api/v1/contacts/:id
```

---

## 저장 용량 비교

| 저장소 | 용량 | 설명 |
|--------|------|------|
| MySQL (전체) | **5.64 GB** | contacts + custom_field_values (EAV) |
| Elasticsearch | **312.8 MB** | 50만 문서 (비정규화) |

```
MySQL:  ████████████████████████████████████████ 5.64 GB
ES:     ██ 312.8 MB (18배 작음)
```

> EAV 패턴은 유연하지만 저장 효율이 낮습니다.
> Contact 1개당 커스텀 필드 10개 = 행 10개 (500만 행 폭발)
> ES의 비정규화 + Lucene 압축이 오히려 더 효율적입니다.

---

## 배운 점

- **트레이드오프 설계**: RDBMS의 ACID vs 검색 엔진의 성능, 양쪽 장점을 살리는 아키텍처
- **분산 시스템의 일관성**: Transactional Outbox로 Eventually Consistent 보장
- **실측 기반 의사결정**: 추측이 아닌 벤치마크 수치로 기술 선택 검증

---

## 라이선스

MIT License
