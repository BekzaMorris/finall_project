import { Router, type Request, type Response } from 'express';
import * as configuratorService from '../services/configurator.service.js';
import { matchSchema, quoteSchema } from '../schemas/configurator.schema.js';
import { validateBody } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import { sendQuoteNotification } from '../services/email.service.js';
import { env } from '../config/env.js';

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/configurator/workloads
 * Returns available workload types with descriptions and defaults.
 * Public endpoint — no authentication required.
 */
router.get('/workloads', (_req: Request, res: Response): void => {
  const workloads = configuratorService.getWorkloadTypes();
  res.status(200).json(workloads);
});

/**
 * POST /api/configurator/match
 * Match products against the current configurator state.
 * Validates body with matchSchema, returns totalMatches and equivalent filters.
 * Public endpoint — no authentication required.
 */
router.post(
  '/match',
  validateBody(matchSchema),
  async (req: Request, res: Response): Promise<void> => {
    const result = await configuratorService.matchProducts(req.body);
    res.status(200).json({
      totalMatches: result.totalMatches,
      filters: result.filters,
    });
  },
);

/**
 * POST /api/configurator/quote
 * Submit a quote request with configuration and contact information.
 * Saves the quote to the database and sends a notification email to managers.
 * Email is sent asynchronously (fire-and-forget) — does not block the response.
 * Returns 201 with quoteId and confirmation message.
 */
router.post(
  '/quote',
  validateBody(quoteSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { configuration, contactName, contactEmail, contactPhone, company } = req.body;

    // Save quote to database
    const quote = await prisma.quote.create({
      data: {
        contactName,
        contactEmail,
        contactPhone,
        company: company ?? null,
        configuration,
      },
    });

    // Send notification email to managers (fire-and-forget, don't block response)
    // In production, we'd query the DB for all manager emails.
    // For now, send to the configured SMTP_FROM as a placeholder.
    sendQuoteNotification(
      {
        quoteId: quote.id,
        workloadType: configuration?.workloadType ?? 'Unknown',
        cpuParams: configuration?.cpu,
        ramParams: configuration?.ram,
        storageParams: configuration?.storage,
        contactName,
        contactEmail,
        contactPhone,
        company,
      },
      [env.SMTP_FROM],
    );

    res.status(201).json({
      quoteId: quote.id,
      message: "We'll contact you",
    });
  },
);

export { router as configuratorRouter };
