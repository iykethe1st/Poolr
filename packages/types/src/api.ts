export const ErrorCode = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // Business logic
  GROUP_FULL: 'GROUP_FULL',
  GROUP_NOT_ACTIVE: 'GROUP_NOT_ACTIVE',
  MEMBER_ALREADY_EXISTS: 'MEMBER_ALREADY_EXISTS',
  CONTRIBUTION_ALREADY_PAID: 'CONTRIBUTION_ALREADY_PAID',
  INSUFFICIENT_WALLET_BALANCE: 'INSUFFICIENT_WALLET_BALANCE',
  KYC_NOT_VERIFIED: 'KYC_NOT_VERIFIED',

  // External services
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  KYC_VERIFICATION_FAILED: 'KYC_VERIFICATION_FAILED',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errorCode?: ErrorCode;
};

export type PaginationParams = {
  page: number;
  limit: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
};
