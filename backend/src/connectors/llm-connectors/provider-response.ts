export function parseProviderResponse(rawResponse: string): Record<string, any> | null {
  try {
    const parsed: unknown = JSON.parse(rawResponse);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : null;
  } catch {
    return null;
  }
}
