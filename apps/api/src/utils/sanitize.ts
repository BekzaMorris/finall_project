import DOMPurify from 'isomorphic-dompurify';

/**
 * Allowed HTML tags for rich text content (ticket messages, product descriptions).
 * Only safe formatting and structural tags are permitted.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'code',
  'pre',
];

/**
 * Allowed HTML attributes. Only href on anchor tags is permitted.
 */
const ALLOWED_ATTR = ['href'];

/**
 * Sanitizes rich text HTML content using DOMPurify.
 *
 * - Strips script tags, event handlers (onclick, onerror, etc.), and javascript: URLs
 * - Allows safe HTML tags: p, br, strong, em, ul, ol, li, a (with href), h1-h6, blockquote, code, pre
 * - Strips all other tags and attributes
 *
 * @param input - The raw HTML string to sanitize
 * @returns The sanitized HTML string
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: [
      'onerror',
      'onclick',
      'onload',
      'onmouseover',
      'onfocus',
      'onblur',
      'onchange',
      'oninput',
      'onsubmit',
      'onkeydown',
      'onkeyup',
      'onkeypress',
    ],
  });
}

/**
 * Strips ALL HTML tags from input, returning plain text only.
 * Useful for contexts where no HTML formatting is allowed.
 *
 * @param input - The raw HTML string to strip
 * @returns Plain text with all HTML tags removed
 */
export function sanitizePlainText(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
