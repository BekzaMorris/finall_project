/**
 * Product slug generation utilities.
 * Generates URL-safe slugs from product names with uniqueness guarantees.
 */

const MAX_SLUG_LENGTH = 200;

/**
 * Cyrillic to Latin transliteration map.
 */
const CYRILLIC_MAP: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'қ': 'q', 'ү': 'u', 'ұ': 'u', 'ғ': 'g', 'ә': 'a', 'ң': 'n',
  'ө': 'o', 'і': 'i', 'һ': 'h',
};

function transliterate(text: string): string {
  return text
    .split('')
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join('');
}

/**
 * Converts a product name to a URL-safe slug.
 * - Transliterates Cyrillic to Latin
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Removes leading/trailing hyphens
 * - Truncates to max 200 characters
 * - Only allows [a-z0-9-]
 * - Falls back to timestamp-based slug if result is empty
 */
export function generateSlug(name: string): string {
  const slug = transliterate(name)
    // Convert to lowercase
    .toLowerCase()
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove consecutive hyphens
    .replace(/-{2,}/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Truncate to max length
      .slice(0, MAX_SLUG_LENGTH)
      // Remove trailing hyphen that may result from truncation
      .replace(/-+$/, '');

  // Fallback for empty slugs (e.g., all-special-character names)
  return slug || `product-${Date.now()}`;
}

/**
 * Generates a unique slug by checking the database for collisions.
 * If the base slug already exists, appends a numeric suffix (-1, -2, -3, etc.)
 * until a unique slug is found.
 */
export async function generateUniqueSlug(
  name: string,
  prisma: {
    product: {
      findFirst: (args: {
        where: { slug: string };
        select: { slug: boolean };
      }) => Promise<{ slug: string } | null>;
    };
  },
): Promise<string> {
  const baseSlug = generateSlug(name);

  // Check if the base slug is available
  const existing = await prisma.product.findFirst({
    where: { slug: baseSlug },
    select: { slug: true },
  });

  if (!existing) {
    return baseSlug;
  }

  // Append numeric suffix until unique
  let suffix = 1;
  while (true) {
    const candidateSlug = `${baseSlug}-${suffix}`;

    // Ensure the slug with suffix doesn't exceed max length
    const truncatedCandidate =
      candidateSlug.length > MAX_SLUG_LENGTH
        ? candidateSlug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '')
        : candidateSlug;

    const conflict = await prisma.product.findFirst({
      where: { slug: truncatedCandidate },
      select: { slug: true },
    });

    if (!conflict) {
      return truncatedCandidate;
    }

    suffix++;
  }
}
