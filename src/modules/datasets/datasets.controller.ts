import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { DatasetsService } from './datasets.service.js';
import { DatasetListItem, DatasetFieldItem } from './dto/dataset.dto.js';

@ApiTags('Datasets')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/datasets')
export class DatasetsController {
  constructor(
    @Inject(DatasetsService) private readonly datasetsService: DatasetsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all datasets accessible to the current user' })
  @ApiResponse({ status: 200, description: 'List of accessible datasets' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: DatasetListItem[] }> {
    const data = await this.datasetsService.findAllForUser(user);
    return { success: true, data };
  }

  @Get(':datasetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dataset metadata by ID' })
  @ApiResponse({ status: 200, description: 'Dataset details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: No access to this dataset' })
  @ApiResponse({ status: 404, description: 'Dataset not found' })
  async findOne(
    @Param('datasetId') datasetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: DatasetListItem }> {
    const data = await this.datasetsService.findOneForUser(datasetId, user);
    return { success: true, data };
  }

  @Get(':datasetId/fields')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dynamic fields configuration for a dataset' })
  @ApiResponse({ status: 200, description: 'List of dataset field configurations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden: No access to this dataset' })
  @ApiResponse({ status: 404, description: 'Dataset not found' })
  async findFields(
    @Param('datasetId') datasetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; data: DatasetFieldItem[] }> {
    const data = await this.datasetsService.findFieldsForDataset(datasetId, user);
    return { success: true, data };
  }
}
