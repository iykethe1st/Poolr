import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { WaivePenaltyDto } from '../penalties/dto/waive-penalty.dto';

@ApiTags('admin')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Groups ────────────────────────────────────────────────────────────────

  @Get('groups')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all groups with stats' })
  listGroups() {
    return this.adminService.listGroups();
  }

  @Get('groups/:id/cycles')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cycle summary with contribution status per member' })
  getCycleSummary(@Param('id') groupId: string) {
    return this.adminService.getCycleSummary(groupId);
  }

  @Get('groups/:id/members')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Member list with KYC and payment status' })
  getMembers(@Param('id') groupId: string) {
    return this.adminService.getMembers(groupId);
  }

  @Post('groups/:id/cycles/:cycleId/trigger-payout')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(202)
  @ApiOperation({ summary: 'Manually trigger a payout for a cycle' })
  triggerPayout(
    @Param('id') groupId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.adminService.triggerPayout(groupId, cycleId);
  }

  // ── Penalties ─────────────────────────────────────────────────────────────

  @Get('penalties')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all pending (applied) penalties' })
  listPendingPenalties() {
    return this.adminService.listPendingPenalties();
  }

  @Post('penalties/:id/waive')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waive any penalty (admin override)' })
  waivePenalty(@Param('id') penaltyId: string, @Body() dto: WaivePenaltyDto) {
    return this.adminService.waivePenalty(penaltyId, dto);
  }

  // ── Users (super-admin only) ──────────────────────────────────────────────

  @Get('users')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all users with KYC status (super-admin only)' })
  listUsers() {
    return this.adminService.listUsers();
  }
}
