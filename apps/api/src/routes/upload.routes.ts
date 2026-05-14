import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { validateFile, uploadFile, type UploadedFile } from '../services/upload.service.js';

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

// ─── Multer Error Handler ────────────────────────────────────────────────────

/**
 * Wraps multer middleware to catch multer-specific errors
 * (file too large, wrong type) and convert them to 400 responses.
 */
function handleMulterErrors(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size exceeds maximum of 10MB' });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    }
    if (err instanceof Error) {
      // Multer fileFilter rejection
      res.status(400).json({ error: err.message });
      return;
    }
    next();
  });
}

// ─── Upload Handler ──────────────────────────────────────────────────────────

/**
 * Shared upload handler for both product and ticket contexts.
 * Validates the file and uploads to S3, returning metadata on success.
 */
async function handleUpload(
  req: Request,
  res: Response,
  context: 'product' | 'ticket',
): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const uploadedFile: UploadedFile = {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size,
  };

  // Validate file (MIME type, magic bytes, size)
  const validation = await validateFile(uploadedFile);

  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  // Upload to S3
  const result = await uploadFile(uploadedFile, req.user!.userId, context);

  res.status(201).json({
    url: result.url,
    key: result.key,
    originalName: result.originalName,
    size: result.size,
    mimeType: result.mimeType,
  });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/uploads/product
 * Upload a product image. Requires MANAGER or ADMIN role.
 */
router.post(
  '/product',
  requireAuth,
  requireManager,
  handleMulterErrors,
  async (req: Request, res: Response): Promise<void> => {
    await handleUpload(req, res, 'product');
  },
);

/**
 * POST /api/uploads/ticket
 * Upload a ticket attachment image. Any authenticated user can upload.
 */
router.post(
  '/ticket',
  requireAuth,
  handleMulterErrors,
  async (req: Request, res: Response): Promise<void> => {
    await handleUpload(req, res, 'ticket');
  },
);

export { router as uploadRouter };
