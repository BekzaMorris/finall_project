import multer from 'multer';
import type { Request } from 'express';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10_485_760; // 10MB in bytes

// ─── Multer Configuration ────────────────────────────────────────────────────

/**
 * Multer middleware configured for image uploads:
 * - Memory storage (buffer available on req.file.buffer)
 * - Max file size: 10MB
 * - Only accepts image MIME types
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted'));
    }
  },
});

/**
 * Single file upload middleware.
 * Expects the file field to be named 'file'.
 */
export const uploadSingle = upload.single('file');

/**
 * Multiple file upload middleware (max 5 files).
 * Expects the file field to be named 'files'.
 */
export const uploadMultiple = upload.array('files', 5);
