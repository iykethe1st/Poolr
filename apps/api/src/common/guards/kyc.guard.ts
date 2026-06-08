import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class KycGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Unauthenticated');

    const kyc = await this.prisma.kycProfile.findUnique({ where: { userId } });
    if (!kyc || kyc.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException('KYC verification required to access this resource');
    }

    return true;
  }
}
