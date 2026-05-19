// Single point of clipboard access. Returns success bool so callers can show
// feedback without a try/catch in every component.

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
