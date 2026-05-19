// Markdown <-> HTML conversion. marked + turndown are lazy-loaded so the page
// itself ships near-empty.

export interface MarkdownToHtmlOptions {
  gfm?: boolean;
  breaks?: boolean;
}

export async function markdownToHtml(md: string, options: MarkdownToHtmlOptions = {}): Promise<string> {
  const { marked } = await import("marked");
  marked.setOptions({
    gfm: options.gfm ?? true,
    breaks: options.breaks ?? false,
  });
  return marked.parse(md, { async: false }) as string;
}

export async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import("turndown")).default;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
  });
  return td.turndown(html);
}
