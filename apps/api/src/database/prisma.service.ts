import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    this.client = new PrismaClient({
      adapter,
      log: config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  // Expose raw client for transactions
  get $(): PrismaClient {
    return this.client;
  }

  // Model accessors — usage: this.prisma.user.findMany()
  get user() { return this.client.user; }
  get kycProfile() { return this.client.kycProfile; }
  get group() { return this.client.group; }
  get groupAccount() { return this.client.groupAccount; }
  get groupMember() { return this.client.groupMember; }
  get cycle() { return this.client.cycle; }
  get contribution() { return this.client.contribution; }
  get contributionFee() { return this.client.contributionFee; }
  get payout() { return this.client.payout; }
  get penalty() { return this.client.penalty; }
  get bankAccount() { return this.client.bankAccount; }
  get wallet() { return this.client.wallet; }
  get walletTransaction() { return this.client.walletTransaction; }
  get notification() { return this.client.notification; }
}
