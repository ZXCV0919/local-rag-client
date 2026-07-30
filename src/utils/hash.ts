export async function computeContentHash(content: ArrayBuffer | string): Promise<string> {
  const data =
    typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
