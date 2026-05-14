import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizePlainText } from './sanitize.js';

describe('sanitizeHtml', () => {
  describe('script tag removal', () => {
    it('removes inline script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Hello</p>');
    });

    it('removes script tags with attributes', () => {
      const input = '<script type="text/javascript" src="evil.js"></script><p>Safe</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('evil.js');
      expect(result).toContain('<p>Safe</p>');
    });
  });

  describe('event handler removal', () => {
    it('removes onclick handlers', () => {
      const input = '<p onclick="alert(1)">Click me</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
      expect(result).toContain('<p>Click me</p>');
    });

    it('removes onerror handlers', () => {
      const input = '<img onerror="alert(1)" src="x">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('removes onload handlers', () => {
      const input = '<p onload="malicious()">Text</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onload');
      expect(result).toContain('Text');
    });

    it('removes onmouseover handlers', () => {
      const input = '<a onmouseover="steal()">Hover</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('Hover');
    });
  });

  describe('javascript: URL removal', () => {
    it('removes javascript: URLs from href', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
    });

    it('removes javascript: URLs with encoding', () => {
      const input = '<a href="&#106;avascript:alert(1)">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('alert');
    });

    it('allows valid http URLs in href', () => {
      const input = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(input);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('<a');
    });
  });

  describe('safe tags preserved', () => {
    it('preserves p tags', () => {
      const input = '<p>Paragraph content</p>';
      expect(sanitizeHtml(input)).toBe('<p>Paragraph content</p>');
    });

    it('preserves strong and em tags', () => {
      const input = '<strong>Bold</strong> and <em>italic</em>';
      expect(sanitizeHtml(input)).toBe('<strong>Bold</strong> and <em>italic</em>');
    });

    it('preserves list tags', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      expect(sanitizeHtml(input)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
    });

    it('preserves ordered list tags', () => {
      const input = '<ol><li>First</li><li>Second</li></ol>';
      expect(sanitizeHtml(input)).toBe('<ol><li>First</li><li>Second</li></ol>');
    });

    it('preserves anchor tags with href', () => {
      const input = '<a href="https://example.com">Link</a>';
      expect(sanitizeHtml(input)).toContain('<a href="https://example.com">Link</a>');
    });

    it('preserves heading tags', () => {
      const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      expect(sanitizeHtml(input)).toContain('<h1>Title</h1>');
      expect(sanitizeHtml(input)).toContain('<h2>Subtitle</h2>');
      expect(sanitizeHtml(input)).toContain('<h3>Section</h3>');
    });

    it('preserves blockquote tags', () => {
      const input = '<blockquote>Quoted text</blockquote>';
      expect(sanitizeHtml(input)).toBe('<blockquote>Quoted text</blockquote>');
    });

    it('preserves code and pre tags', () => {
      const input = '<pre><code>const x = 1;</code></pre>';
      expect(sanitizeHtml(input)).toBe('<pre><code>const x = 1;</code></pre>');
    });

    it('preserves br tags', () => {
      const input = 'Line 1<br>Line 2';
      expect(sanitizeHtml(input)).toContain('Line 1');
      expect(sanitizeHtml(input)).toContain('Line 2');
      expect(sanitizeHtml(input)).toContain('<br>');
    });
  });

  describe('disallowed tags stripped', () => {
    it('strips div tags', () => {
      const input = '<div>Content</div>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<div');
      expect(result).toContain('Content');
    });

    it('strips img tags', () => {
      const input = '<img src="image.jpg" alt="test">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<img');
    });

    it('strips iframe tags', () => {
      const input = '<iframe src="https://evil.com"></iframe>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('evil.com');
    });

    it('strips style tags', () => {
      const input = '<style>body { display: none; }</style><p>Text</p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<style');
      expect(result).toContain('<p>Text</p>');
    });
  });

  describe('nested XSS attempts blocked', () => {
    it('blocks nested script in allowed tags', () => {
      const input = '<p><strong><script>alert("xss")</script></strong></p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
    });

    it('blocks SVG-based XSS', () => {
      const input = '<svg onload="alert(1)"><circle r="50"></circle></svg>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<svg');
      expect(result).not.toContain('onload');
    });

    it('blocks data URI XSS in anchor tags', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('data:text/html');
    });

    it('blocks mixed case script tags', () => {
      const input = '<ScRiPt>alert("xss")</ScRiPt>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('blocks event handlers in nested elements', () => {
      const input = '<p><a href="#" onclick="steal()">Link</a></p>';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('steal');
    });

    it('blocks object/embed tags', () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf">';
      const result = sanitizeHtml(input);
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
      expect(result).not.toContain('evil.swf');
    });
  });
});

describe('sanitizePlainText', () => {
  it('strips all HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitizePlainText(input)).toBe('Hello world');
  });

  it('strips anchor tags and preserves text', () => {
    const input = '<a href="https://example.com">Link text</a>';
    expect(sanitizePlainText(input)).toBe('Link text');
  });

  it('strips script tags and their content', () => {
    const input = 'Safe text<script>alert("xss")</script>';
    const result = sanitizePlainText(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Safe text');
  });

  it('strips all formatting tags', () => {
    const input = '<h1>Title</h1><p><em>Italic</em> and <strong>bold</strong></p>';
    expect(sanitizePlainText(input)).toBe('TitleItalic and bold');
  });

  it('handles nested HTML', () => {
    const input = '<div><ul><li>Item 1</li><li>Item 2</li></ul></div>';
    const result = sanitizePlainText(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
  });

  it('returns empty string for script-only content', () => {
    const input = '<script>alert("xss")</script>';
    const result = sanitizePlainText(input);
    expect(result).not.toContain('alert');
    expect(result).not.toContain('<');
  });

  it('handles plain text input unchanged', () => {
    const input = 'Just plain text with no HTML';
    expect(sanitizePlainText(input)).toBe('Just plain text with no HTML');
  });
});
