import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../config/env.js';
import { ValidationError } from '../utils/errors.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10_485_760; // 10MB in bytes

// ─── S3 Client Setup ─────────────────────────────────────────────────────────

export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: 'us-east-1', // MinIO requires a region but ignores it
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface UploadResult {
  url: string;
  key: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export type UploadContext = 'product' | 'ticket';

// ─── File Validation ─────────────────────────────────────────────────────────

/**
 * Validates an uploaded file for MIME type, magic bytes, and size.
 * Returns a specific error message for each validation failure.
 */
export async function validateFile(
  file: UploadedFile,
): Promise<{ valid: true } | { valid: false; error: string }> {
  // Check size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${file.size} bytes exceeds maximum of ${MAX_FILE_SIZE} bytes (10MB)`,
    };
  }

  // Check MIME type from multer (declared type)
  if (!file.mimetype.startsWith('image/')) {
    return {
      valid: false,
      error: `Invalid MIME type '${file.mimetype}'. Only image files are accepted`,
    };
  }

  // Check magic bytes match declared type
  const detectedType = await fileTypeFromBuffer(file.buffer);

  if (!detectedType) {
    return {
      valid: false,
      error: 'Unable to determine file type from content. File may be corrupted',
    };
  }

  if (!detectedType.mime.startsWith('image/')) {
    return {
      valid: false,
      error: `File content does not match declared type. Detected '${detectedType.mime}' but expected an image`,
    };
  }

  return { valid: true };
}

// ─── File Upload ─────────────────────────────────────────────────────────────

/**
 * Uploads a validated file to S3/MinIO storage.
 * Generates a unique key: {context}/{userId}/{uuid}.{ext}
 */
export async function uploadFile(
  file: UploadedFile,
  userId: string,
  context: UploadContext,
): Promise<UploadResult> {
  // Determine extension from detected file type or fallback to original
  const detectedType = await fileTypeFromBuffer(file.buffer);
  const ext = detectedType?.ext ?? getExtensionFromMime(file.mimetype);

  // Generate unique key
  const uuid = randomUUID();
  const key = `${context}/${userId}/${uuid}.${ext}`;

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  // Build public URL
  const url = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;

  return {
    url,
    key,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
}

// ─── File Deletion ───────────────────────────────────────────────────────────

/**
 * Deletes a file from S3/MinIO by its key.
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts file extension from MIME type.
 * Fallback when file-type detection doesn't provide an extension.
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/avif': 'avif',
  };

  return mimeToExt[mimeType] ?? 'bin';
}
