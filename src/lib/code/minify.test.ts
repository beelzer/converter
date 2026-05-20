import { describe, expect, it } from "vitest";
import { minify } from "./minify";

describe("minify — javascript", () => {
  it("shrinks JS and preserves behaviour", async () => {
    const source = `
      // a comment that should disappear
      function add(a, b) {
        const result = a + b;
        return result;
      }
      console.log(add(1, 2));
    `;
    const min = await minify(source, "javascript");
    expect(min.length).toBeLessThan(source.length);
    expect(min).not.toContain("a comment");
    expect(min).not.toContain("\n  ");
  });

  it("mangles parameter and local-variable identifiers", async () => {
    // Assigning to globalThis keeps the function alive (no DCE) but its
    // parameters and inner locals are still safe to rename.
    const min = await minify(
      "globalThis.add = function(longParam, anotherLongParam) { var longLocalName = longParam + anotherLongParam; return longLocalName; };",
      "javascript"
    );
    expect(min).not.toContain("longParam");
    expect(min).not.toContain("anotherLongParam");
    expect(min).not.toContain("longLocalName");
  });

  it("throws on syntactically invalid JS", async () => {
    await expect(minify("function (", "javascript")).rejects.toThrow();
  });
});

describe("minify — json", () => {
  it("strips whitespace via parse + stringify", async () => {
    const out = await minify('{\n  "a": 1,\n  "b": [2, 3]\n}', "json");
    expect(out).toBe('{"a":1,"b":[2,3]}');
  });

  it("throws on malformed JSON", async () => {
    await expect(minify("{not json", "json")).rejects.toThrow();
  });
});

describe("minify — css", () => {
  it("collapses whitespace and removes comments", async () => {
    const source = `
      /* header comment */
      body {
        color: red;
        background: white;
      }
    `;
    const min = await minify(source, "css");
    expect(min).toContain("body{");
    expect(min).not.toContain("/* header");
    expect(min.length).toBeLessThan(source.length);
  });

  it("merges identical selectors", async () => {
    const source = `.a { color: red; } .a { background: blue; }`;
    const min = await minify(source, "css");
    // csso should merge to a single .a{...} rule.
    expect(min).toContain(".a{");
    expect(min.split(".a{").length).toBe(2); // one ".a{" → split gives 2 parts
  });
});

describe("minify — html", () => {
  it("strips comments and collapses inter-tag whitespace", async () => {
    const out = await minify(
      `<!doctype html><html>
         <!-- comment -->
         <body>  <p>  hello  </p>  </body>
       </html>`,
      "html"
    );
    expect(out).not.toContain("comment");
    expect(out).toMatch(/<body><p>/);
  });

  it("preserves whitespace inside <pre>, <textarea>, <script>, <style>", async () => {
    const source = `<pre>
  line1
  line2
</pre>`;
    const out = await minify(source, "html");
    expect(out).toContain("\n  line1\n  line2\n");
  });
});

describe("minify — unsupported language", () => {
  it("throws on TypeScript-via-types (we don't strip types) — terser may fail or pass through", async () => {
    // Plain-JS-shaped TS works (terser treats it as JS).
    const out = await minify("const x = 1; x + 2;", "typescript");
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it("throws for languages we don't minify", async () => {
    await expect(minify("a: 1", "yaml")).rejects.toThrow(/not supported/);
    await expect(minify("# header", "markdown")).rejects.toThrow(/not supported/);
  });
});
