import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';
import { AdminService } from './admin.service.js';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateRolePermissionsDto,
  AddDatasetMemberDto,
} from './dto/admin.dto.js';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, RolesGuard)
@Roles(ROLES.ADMINISTRATOR)
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly adminService: AdminService,
  ) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get platform administration metrics, health, and logs overview' })
  async getOverview() {
    const data = await this.adminService.getOverview();
    return { success: true, data };
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List platform users with roles' })
  async getUsers(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const result = await this.adminService.getUsers(q, p, ps);
    return { success: true, ...result };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.createUser(dto, user);
    return { success: true, data };
  }

  @Patch('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile or role' })
  async updateUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.adminService.updateUser(userId, dto, user);
    return { success: true, data };
  }

  @Delete('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate and delete user' })
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.deleteUser(userId, user);
    return result;
  }

  @Get('roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all roles with member counts and permissions' })
  async getRoles() {
    const data = await this.adminService.getRoles();
    return { success: true, data };
  }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all system permissions' })
  async getPermissions() {
    const data = await this.adminService.getPermissions();
    return { success: true, data };
  }

  @Get('roles/:roleId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get permissions assigned to a role' })
  async getRolePermissions(@Param('roleId') roleId: string) {
    const data = await this.adminService.getRolePermissions(roleId);
    return { success: true, data };
  }

  @Put('roles/:roleId/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update permissions assigned to a role' })
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.updateRolePermissions(
      roleId,
      dto.permissionIds,
      user,
    );
    return result;
  }

  @Get('datasets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List datasets with their members and permissions' })
  async getDatasets() {
    const data = await this.adminService.getDatasetsWithMembers();
    return { success: true, data };
  }

  @Post('datasets/:datasetId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add or update member access on dataset' })
  async addDatasetMember(
    @Param('datasetId') datasetId: string,
    @Body() dto: AddDatasetMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.addOrUpdateDatasetMember(
      datasetId,
      dto,
      user,
    );
    return result;
  }

  @Delete('datasets/:datasetId/members/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke dataset membership' })
  async removeDatasetMember(
    @Param('datasetId') datasetId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.adminService.removeDatasetMember(
      datasetId,
      userId,
      user,
    );
    return result;
  }

  @Get('activity-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit activity logs' })
  async getActivityLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getActivityLogs(p, ps, type);
    return { success: true, ...result };
  }

  @Get('logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get audit activity logs (alias)' })
  async getLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
  ) {
    return this.getActivityLogs(page, pageSize, type);
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get query performance logs' })
  async getPerformance(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getPerformanceLogs(p, ps);
    return { success: true, ...result };
  }

  @Get('exports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List background export jobs' })
  async getExports(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const result = await this.adminService.getExports(p, ps);
    return { success: true, ...result };
  }
}
