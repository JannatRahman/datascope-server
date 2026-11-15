import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { ExportsService } from './exports.service.js';
import { CreateExportDto } from './dto/export.dto.js';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1')
export class ExportsController {
  constructor(
    @Inject(ExportsService) private readonly exportsService: ExportsService,
  ) { }

  @Post('datasets/:datasetId/export')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger asynchronous dataset export job (CSV or JSON)' })
  @ApiResponse({ status: 202, description: 'Export job initiated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Viewers cannot export data' })
  async createExport(
    @Param('datasetId') datasetId: string,
    @Body() dto: CreateExportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const job = await this.exportsService.createExportJob(datasetId, dto, user);
    return {
      success: true,
      message: 'Export job scheduled successfully',
      data: job,
    };
  }

  @Get('exports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List user export jobs' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.exportsService.findAll(user);
    return { success: true, data };
  }

  @Get('exports/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get export job details and status' })
  async findOne(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.exportsService.findOne(jobId, user);
    return { success: true, data };
  }

  @Post('exports/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an in-progress export job' })
  async cancel(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.exportsService.cancelExportJob(jobId, user);
    return result;
  }

  @Get('exports/:jobId/download')
  @ApiOperation({ summary: 'Download generated export file (CSV or JSON)' })
  async download(
    @Param('jobId') jobId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { filePath, fileName, format } = await this.exportsService.getExportFile(jobId, user);
    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    res.setHeader('Content-Type', contentType);
    res.download(filePath, fileName);
  }
}
