import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { SearchHistoryService } from './search-history.service.js';
import { RecordSearchDto } from './dto/search-history.dto.js';

@ApiTags('Search History')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/search-history')
export class SearchHistoryController {
  constructor(
    @Inject(SearchHistoryService) private readonly searchHistoryService: SearchHistoryService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List current user search history' })
  async findAll(
    @Query('datasetId') datasetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.searchHistoryService.findAll(user, datasetId);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a search action into search history' })
  async recordSearch(
    @Body() dto: RecordSearchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.searchHistoryService.recordSearch(user, dto);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete individual search history entry' })
  async deleteEntry(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.searchHistoryService.deleteEntry(id, user);
    return result;
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all search history for current user' })
  async clearAll(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.searchHistoryService.clearAll(user);
    return result;
  }
}
