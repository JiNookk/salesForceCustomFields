import {
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReindexService } from '../../../application/reindex/reindex.service';

/**
 * 재인덱싱 Admin API
 * - 전체/개별 Contact ES 재인덱싱
 * - Queue 상태 조회
 */
@Controller('api/v1/admin/reindex')
export class ReindexController {
  constructor(private readonly reindexService: ReindexService) {}

  /**
   * 전체 Contact 재인덱싱
   * POST /api/v1/admin/reindex/contacts
   */
  @Post('contacts')
  @HttpCode(HttpStatus.ACCEPTED)
  async reindexAll() {
    const result = await this.reindexService.reindexAll();
    return {
      message: `${result.queued} contacts queued for reindexing`,
      ...result,
    };
  }

  /**
   * 특정 Contact 재인덱싱
   * POST /api/v1/admin/reindex/contacts/:id
   */
  @Post('contacts/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  async reindexOne(@Param('id') id: string) {
    await this.reindexService.reindexOne(id);
    return {
      message: `Contact ${id} queued for reindexing`,
    };
  }

  /**
   * Queue 상태 조회
   * GET /api/v1/admin/reindex/status
   */
  @Get('status')
  async getStatus() {
    return this.reindexService.getQueueStats();
  }
}
