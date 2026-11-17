/** Login ke baad sirf app ke andar ka relative URL. Open redirect se bachav. */
export function safeReturnUrl(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.startsWith('/login')) {
    return '/dashboard';
  }
  return raw;
}