import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

// Mock file-type
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

import { fileTypeFromBuffer } from 'file-type';
import { validateFile, uploadFile, deleteFile } from './upload.service.js';
import type { UploadedFile } from './upload.service.js';

const mockFileTypeFromBuffer = fileTypeFromBuffer as ReturnType<typeof vi.fn>;

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Creates a minimal PNG file header (magic bytes) */
function createPngBuffer(): Buffer {
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
}

/** Creates a minimal JPEG file header (magic bytes) */
function createJpegBuffer(): Buffer {
  // JPEG magic bytes: FF D8 FF
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function createValidFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    buffer: createPngBuffer(),
    mimetype: 'image/png',
    originalname: 'test-image.png',
    size: 1024,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Upload Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validateFile ──────────────────────────────────────────────────────

  describe('validateFile', () => {
    it('accepts a valid PNG image', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const file = createValidFile();
      const result = await validateFile(file);

      expect(result).toEqual({ valid: true });
    });

    it('accepts a valid JPEG image', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'jpg',
        mime: 'image/jpeg',
      });

      const file = createValidFile({
        buffer: createJpegBuffer(),
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      });
      const result = await validateFile(file);

      expect(result).toEqual({ valid: true });
    });

    it('accepts a valid WebP image', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'webp',
        mime: 'image/webp',
      });

      const file = createValidFile({
        mimetype: 'image/webp',
        originalname: 'photo.webp',
      });
      const result = await validateFile(file);

      expect(result).toEqual({ valid: true });
    });

    it('rejects file with non-image MIME type', async () => {
      const file = createValidFile({
        mimetype: 'application/pdf',
        originalname: 'document.pdf',
      });

      const result = await validateFile(file);

      expect(result).toEqual({
        valid: false,
        error: "Invalid MIME type 'application/pdf'. Only image files are accepted",
      });
    });

    it('rejects file with text MIME type', async () => {
      const file = createValidFile({
        mimetype: 'text/plain',
        originalname: 'readme.txt',
      });

      const result = await validateFile(file);

      expect(result).toEqual({
        valid: false,
        error: "Invalid MIME type 'text/plain'. Only image files are accepted",
      });
    });

    it('rejects file exceeding 10MB size limit', async () => {
      const file = createValidFile({
        size: 10_485_761, // 10MB + 1 byte
      });

      const result = await validateFile(file);

      expect(result).toEqual({
        valid: false,
        error: 'File size 10485761 bytes exceeds maximum of 10485760 bytes (10MB)',
      });
    });

    it('accepts file exactly at 10MB size limit', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const file = createValidFile({
        size: 10_485_760, // Exactly 10MB
      });

      const result = await validateFile(file);

      expect(result).toEqual({ valid: true });
    });

    it('rejects file when magic bytes do not match declared image type', async () => {
      // File claims to be image/png but magic bytes say it's application/pdf
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'pdf',
        mime: 'application/pdf',
      });

      const file = createValidFile({
        mimetype: 'image/png',
        originalname: 'fake-image.png',
      });

      const result = await validateFile(file);

      expect(result).toEqual({
        valid: false,
        error: "File content does not match declared type. Detected 'application/pdf' but expected an image",
      });
    });

    it('rejects file when magic bytes cannot be determined', async () => {
      mockFileTypeFromBuffer.mockResolvedValue(undefined);

      const file = createValidFile({
        buffer: Buffer.from([0x00, 0x00, 0x00, 0x00]),
      });

      const result = await validateFile(file);

      expect(result).toEqual({
        valid: false,
        error: 'Unable to determine file type from content. File may be corrupted',
      });
    });

    it('rejects file with executable content disguised as image', async () => {
      // File claims to be image/jpeg but is actually an EXE
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'exe',
        mime: 'application/x-dosexec',
      });

      const file = createValidFile({
        mimetype: 'image/jpeg',
        originalname: 'totally-an-image.jpg',
      });

      const result = await validateFile(file);

      expect(result).toEqual({
        valid: false,
        error: "File content does not match declared type. Detected 'application/x-dosexec' but expected an image",
      });
    });

    it('checks size before MIME type (early exit on oversized)', async () => {
      const file = createValidFile({
        size: 20_000_000,
        mimetype: 'application/pdf', // Also invalid MIME
      });

      const result = await validateFile(file);

      // Size check comes first
      expect(result).toEqual({
        valid: false,
        error: 'File size 20000000 bytes exceeds maximum of 10485760 bytes (10MB)',
      });
      // fileTypeFromBuffer should not be called since size check fails first
      expect(mockFileTypeFromBuffer).not.toHaveBeenCalled();
    });
  });

  // ─── uploadFile ────────────────────────────────────────────────────────

  describe('uploadFile', () => {
    it('uploads file and returns correct metadata', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const file = createValidFile();
      const result = await uploadFile(file, 'user-123', 'product');

      expect(result.originalName).toBe('test-image.png');
      expect(result.size).toBe(1024);
      expect(result.mimeType).toBe('image/png');
      expect(result.key).toMatch(/^product\/user-123\/[a-f0-9-]+\.png$/);
      expect(result.url).toContain(result.key);
    });

    it('generates key with correct context and userId', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'jpg',
        mime: 'image/jpeg',
      });

      const file = createValidFile({
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      });
      const result = await uploadFile(file, 'user-456', 'ticket');

      expect(result.key).toMatch(/^ticket\/user-456\/[a-f0-9-]+\.jpg$/);
    });

    it('generates unique keys for multiple uploads', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({ ext: 'png', mime: 'image/png' });

      const file = createValidFile();
      const result1 = await uploadFile(file, 'user-123', 'product');
      const result2 = await uploadFile(file, 'user-123', 'product');

      expect(result1.key).not.toBe(result2.key);
    });

    it('uses detected extension over MIME-derived extension', async () => {
      mockFileTypeFromBuffer.mockResolvedValue({
        ext: 'webp',
        mime: 'image/webp',
      });

      const file = createValidFile({
        mimetype: 'image/webp',
        originalname: 'image.webp',
      });
      const result = await uploadFile(file, 'user-123', 'product');

      expect(result.key).toMatch(/\.webp$/);
    });
  });

  // ─── deleteFile ────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('calls S3 DeleteObjectCommand with correct key', async () => {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      await deleteFile('product/user-123/abc-def.png');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: expect.any(String),
        Key: 'product/user-123/abc-def.png',
      });
    });
  });
});
