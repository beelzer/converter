import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

describe("markdownToHtml", () => {
  it("renders headings, lists, and links", async () => {
    const html = await markdownToHtml("# Title\n\n- one\n- [two](https://example.com)\n");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toMatch(/<ul>[\s\S]*<li>one<\/li>/);
    expect(html).toContain('<a href="https://example.com">two</a>');
  });

  it("preserves fenced code blocks", async () => {
    const html = await markdownToHtml("```ts\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
    expect(html).toContain("const x = 1;");
  });

  it("enables GFM tables by default", async () => {
    const md = "| a | b |\n| - | - |\n| 1 | 2 |\n";
    const html = await markdownToHtml(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("inserts hard breaks only when breaks=true", async () => {
    const md = "line 1\nline 2";
    const without = await markdownToHtml(md);
    const withBreaks = await markdownToHtml(md, { breaks: true });
    expect(without).not.toContain("<br");
    expect(withBreaks).toContain("<br");
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings, paragraphs and lists", async () => {
    const md = await htmlToMarkdown("<h1>Title</h1><p>Body</p><ul><li>one</li><li>two</li></ul>");
    expect(md).toContain("# Title");
    expect(md).toContain("Body");
    expect(md).toMatch(/-\s+one/);
    expect(md).toMatch(/-\s+two/);
  });

  it("uses fenced code blocks", async () => {
    const md = await htmlToMarkdown("<pre><code>const x = 1;</code></pre>");
    expect(md).toContain("```");
    expect(md).toContain("const x = 1;");
  });

  it("uses underscores for emphasis (per configured emDelimiter)", async () => {
    const md = await htmlToMarkdown("<p>hello <em>world</em></p>");
    expect(md.trim()).toBe("hello _world_");
  });
});

describe("markdown → HTML → markdown round-trip", () => {
  it("preserves a basic document's structure", async () => {
    const original = "# Title\n\nBody text with **strong** and _emphasis_.\n";
    const html = await markdownToHtml(original);
    const back = await htmlToMarkdown(html);
    expect(back).toContain("# Title");
    expect(back).toContain("**strong**");
    expect(back).toContain("_emphasis_");
  });
});
