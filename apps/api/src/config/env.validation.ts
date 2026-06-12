import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3002),

  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // External integrations — optional in dev
  PAYSTACK_SECRET_KEY: Joi.string().allow('').optional(),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  DOJAH_APP_ID: Joi.string().allow('').optional(),
  DOJAH_SECRET_KEY: Joi.string().allow('').optional(),
  DOJAH_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  TERMII_API_KEY: Joi.string().allow('').optional(),
  RESEND_API_KEY: Joi.string().allow('').optional(),
  FCM_SERVER_KEY: Joi.string().allow('').optional(),

  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_S3_BUCKET: Joi.string().allow('').optional(),
  AWS_REGION: Joi.string().default('eu-west-1'),

  SENTRY_DSN: Joi.string().allow('').optional(),

  CORS_ORIGINS: Joi.string().allow('').optional(),
}).options({ allowUnknown: true });
