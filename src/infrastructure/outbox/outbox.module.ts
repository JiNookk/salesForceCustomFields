import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { OutboxEntity } from '../persistence/typeorm/entity/outbox.entity';
import { OutboxRepository } from '../persistence/typeorm/repository/outbox.repository';
import { OutboxProcessorService } from './outbox-processor.service';
import { ES_SYNC_QUEUE } from '../queue/es-sync.types';

/**
 * Outbox 모듈
 * - Outbox 패턴 구현 (트랜잭션 보장)
 * - Cron fallback 처리
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEntity]),
    ScheduleModule.forRoot(),
    BullModule.registerQueue({
      name: ES_SYNC_QUEUE,
    }),
  ],
  providers: [OutboxRepository, OutboxProcessorService],
  exports: [OutboxRepository],
})
export class OutboxModule {}
