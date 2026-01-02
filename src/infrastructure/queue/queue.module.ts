import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EsSyncProcessor } from './es-sync.processor';
import { ES_SYNC_QUEUE } from './es-sync.types';

/**
 * Queue 모듈
 * - BullMQ 설정
 * - ES 동기화 프로세서 등록
 */
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '16379', 10),
      },
    }),
    BullModule.registerQueue({
      name: ES_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    }),
  ],
  providers: [EsSyncProcessor],
  exports: [BullModule],
})
export class QueueModule {}
