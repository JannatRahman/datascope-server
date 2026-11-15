import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { RecordsService } from './records.service.js';
import {
  RecordQueryParams,
  PaginatedRecordsResponse,
  RecordListItem,
  RecordRelationshipItem,
} from './dto/record-query.dto.js';

@ApiTags('Records')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/datasets/:datasetId/records')
export class RecordsController {
  constructor(
    @Inject(RecordsService) private readonly recordsService: RecordsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query, filter, sort, and paginate dataset records' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 25 })
  @ApiQuery({ name: 'q', required: false, type: String, example: 'Acme' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'created_at' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], example: 'desc' })
  @ApiQuery({ name: 'filters', required: false, type: String, example: '[{"field":"status","operator":"equals","value":"Active"}]' })
  @ApiQuery({ name: 'filterLogic', required: false, enum: ['AND', 'OR'], example: 'AND' })
  @ApiResponse({ status: 200, description: 'Paginated dataset records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: No access to this dataset' })
  @ApiResponse({ status: 404, description: 'Dataset not found' })
  async findRecords(
    @Param('datasetId') datasetId: string,
    @Query() query: RecordQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedRecordsResponse> {
    return this.recordsService.findRecords(datasetId, query, user);
  }

  @Get(':recordId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get single record by ID' })
  @ApiResponse({ status: 200, description: 'Record details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: No access to this dataset' })
  @ApiResponse({ status: 404, description: 'Record or dataset not found' })
  async findRecordById(
    @Param('datasetId') datasetId: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: RecordListItem }> {
    const data = await this.recordsService.findRecordById(datasetId, recordId, user);
    return { success: true, data };
  }

  @Get(':recordId/relationships')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all cross-dataset relationships for a record' })
  @ApiResponse({ status: 200, description: 'List of record relationships' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: No access to this dataset' })
  @ApiResponse({ status: 404, description: 'Record or dataset not found' })
  async findRecordRelationships(
    @Param('datasetId') datasetId: string,
    @Param('recordId') recordId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: RecordRelationshipItem[] }> {
    const data = await this.recordsService.findRecordRelationships(datasetId, recordId, user);
    return { success: true, data };
  }
}
