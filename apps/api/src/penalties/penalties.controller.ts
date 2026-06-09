import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PenaltiesService } from './penalties.service';
import { WaivePenaltyDto } from './dto/waive-penalty.dto';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('penalties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('penalties')
export class PenaltiesController {
  constructor(private readonly penalties: PenaltiesService) {}

  @Get('me')
  @ApiOperation({ summary: "List the current user's penalties" })
  listMyPenalties(@CurrentUser() user: AuthUser) {
    return this.penalties.listMyPenalties(user.id);
  }

  @Post(':id/waive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Waive a penalty (group admin only)' })
  waivePenalty(
    @Param('id') penaltyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: WaivePenaltyDto,
  ) {
    return this.penalties.waivePenalty(penaltyId, user.id, dto);
  }
}
