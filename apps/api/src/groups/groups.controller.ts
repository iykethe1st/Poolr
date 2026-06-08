import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { KycGuard } from '../common/guards/kyc.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new group' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List groups the current user belongs to' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.groups.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group details' })
  findOne(@Param('id') groupId: string, @CurrentUser() user: AuthUser) {
    return this.groups.findOne(groupId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group settings (admin only)' })
  update(
    @Param('id') groupId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(groupId, user.id, dto);
  }

  @Post(':id/invite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Invite a member by phone or email (admin only)' })
  invite(
    @Param('id') groupId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.groups.inviteMember(groupId, user.id, dto);
  }

  @Post(':id/join')
  @HttpCode(200)
  @UseGuards(KycGuard)
  @ApiOperation({ summary: 'Accept a group invitation (KYC required)' })
  join(
    @Param('id') groupId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinGroupDto,
  ) {
    return this.groups.joinGroup(groupId, user.id, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a member (admin only)' })
  removeMember(@Param('id') groupId: string, @Param('memberId') memberId: string, @CurrentUser() user: AuthUser) {
    return this.groups.removeMember(groupId, user.id, memberId);
  }

  @Patch(':id/members/:memberId/position')
  @ApiOperation({ summary: 'Update rotation position (admin only)' })
  updatePosition(
    @Param('id') groupId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.groups.updatePosition(groupId, user.id, memberId, dto);
  }

  @Post(':id/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lock group and generate rotation cycles (admin only)' })
  start(@Param('id') groupId: string, @CurrentUser() user: AuthUser) {
    return this.groups.startGroup(groupId, user.id);
  }
}
