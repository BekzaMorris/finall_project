import { z } from 'zod';

// ─── CPU Config Schema ───────────────────────────────────────────────────────

const cpuConfigSchema = z.object({
  family: z.string().optional(),
  cores: z.object({
    min: z.number().int().min(1).optional(),
    max: z.number().int().max(128).optional(),
  }).optional(),
  count: z.number().int().min(1).max(8).optional(),
  frequency: z.object({
    min: z.number().min(0).optional(),
    max: z.number().optional(),
  }).optional(),
  socket: z.string().optional(),
});

// ─── RAM Config Schema ───────────────────────────────────────────────────────

const ramConfigSchema = z.object({
  sizeGb: z.object({
    min: z.number().int().min(1).optional(),
    max: z.number().int().optional(),
  }).optional(),
  type: z.string().optional(),
  frequency: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }).optional(),
  slots: z.number().int().min(1).optional(),
});

// ─── Storage Config Schema ───────────────────────────────────────────────────

const storageConfigSchema = z.object({
  type: z.string().optional(),
  sizeGb: z.object({
    min: z.number().int().min(1).optional(),
    max: z.number().int().optional(),
  }).optional(),
  hotSwap: z.boolean().optional(),
  count: z.number().int().min(1).optional(),
});

// ─── Workload Types ──────────────────────────────────────────────────────────

const workloadTypeEnum = z.enum([
  'database',
  'virtualization',
  'web_hosting',
  'ai_ml',
  'file_storage',
  'general',
]);

// ─── Match Schema ────────────────────────────────────────────────────────────

export const matchSchema = z.object({
  workloadType: workloadTypeEnum.optional(),
  cpu: cpuConfigSchema.optional(),
  ram: ramConfigSchema.optional(),
  storage: storageConfigSchema.optional(),
  step: z.number().int().min(1).max(4).optional(),
}).strict();

// ─── Quote Schema ────────────────────────────────────────────────────────────

export const quoteSchema = z.object({
  configuration: z.object({
    workloadType: workloadTypeEnum.optional(),
    cpu: cpuConfigSchema.optional(),
    ram: ramConfigSchema.optional(),
    storage: storageConfigSchema.optional(),
  }),
  contactName: z.string().min(1, 'Contact name is required').max(200),
  contactEmail: z.string().email('Invalid email format').max(255),
  contactPhone: z.string().min(1, 'Phone is required').max(50),
  company: z.string().max(200).optional(),
}).strict();

// ─── Exports ─────────────────────────────────────────────────────────────────

export { workloadTypeEnum, cpuConfigSchema, ramConfigSchema, storageConfigSchema };
