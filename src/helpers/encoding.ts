/**
 * Check if string is encoded with Base64.
 *
 * @param str {string} String to check.
 *
 * @returns {string | null} Decoded value or null if string is not encoded with Base64.
 */
export const isBase64 = (str: string): string | null => {
  const decoded = Buffer.from(str, 'base64');
  return decoded.toString('base64') === str ? decoded.toString() : null;
};
