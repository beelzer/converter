export function urlEncode(input: string, full = true): string {
  return full ? encodeURIComponent(input) : encodeURI(input);
}

export function urlDecode(input: string): string {
  return decodeURIComponent(input);
}
