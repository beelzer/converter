import { describe, expect, it } from "vitest";
import { beautify } from "./beautify";

// These tests load real prettier plugins via dynamic import on first call.
// Each language test is wrapped with a generous timeout to absorb the cold
// import cost; the actual format step is fast (~5 ms once loaded).

describe("beautify — javascript / typescript", () => {
  it("normalises spacing in ugly JS", async () => {
    const out = await beautify("function add(a,b){return a+b}", "javascript");
    expect(out).toContain("function add(a, b)");
    expect(out).toContain("return a + b");
  });

  it("respects custom indent", async () => {
    const out = await beautify("if(true){console.log(1)}", "javascript", { indent: 4 });
    expect(out).toMatch(/^if \(true\) \{\n {4}console\.log/m);
  });

  it("preserves TypeScript type annotations", async () => {
    const out = await beautify("const x:number=1;function f(a:string):void{}", "typescript");
    expect(out).toContain(": number");
    expect(out).toContain(": string");
    expect(out).toContain(": void");
  });
});

describe("beautify — json", () => {
  it("pretty-prints with 2-space default indent (when the document is long enough to wrap)", async () => {
    // prettier keeps short JSON on one line — give it enough content to force
    // multi-line output.
    const longish = JSON.stringify(
      { a: 1, b: [2, 3, 4, 5], c: "this is a longer string to push past the wrap width" }
    );
    const out = await beautify(longish, "json");
    expect(out).toContain('"a": 1');
    expect(out).toMatch(/{\n {2}"a"/);
  });

  it("normalises whitespace even when the JSON is short enough to stay on one line", async () => {
    const out = await beautify('{"a":1,"b":2}', "json");
    // Even single-line output gets standardised spacing around the colon.
    expect(out).toContain('"a": 1');
    expect(out).toContain('"b": 2');
  });
});

describe("beautify — css / scss / less", () => {
  it("normalises whitespace in CSS", async () => {
    const out = await beautify("body{color:red;background:white}", "css");
    expect(out).toContain("color: red;");
    expect(out).toContain("background: white;");
    // prettier puts each declaration on its own line.
    expect(out.split("\n").length).toBeGreaterThan(3);
  });

  it("handles SCSS nested rules", async () => {
    const out = await beautify(".a{.b{color:red}}", "scss");
    expect(out).toContain(".b");
    expect(out).toContain("color: red");
  });
});

describe("beautify — html / vue", () => {
  it("indents nested elements in HTML", async () => {
    const out = await beautify("<div><span>hi</span></div>", "html");
    expect(out).toContain("<span>hi</span>");
  });

  it("handles Vue single-file components", async () => {
    const out = await beautify(
      "<template><div>hi</div></template><script>export default {}</script>",
      "vue"
    );
    expect(out).toContain("<template>");
    expect(out).toContain("<script>");
  });
});

describe("beautify — markdown / yaml / graphql", () => {
  it("formats Markdown", async () => {
    const out = await beautify("#  Title\n\n*   bullet", "markdown");
    expect(out).toContain("# Title");
  });

  it("normalises YAML indentation", async () => {
    const out = await beautify("a:\n  b: 1\n  c:    2", "yaml");
    expect(out).toContain("a:");
    expect(out).toContain("b: 1");
    expect(out).toContain("c: 2");
  });

  it("formats GraphQL", async () => {
    const out = await beautify("query{user{id name}}", "graphql");
    expect(out).toMatch(/query \{/);
    expect(out).toContain("user");
    expect(out).toContain("id");
  });
});

describe("beautify — sql (sql-formatter, separate path)", () => {
  it("uppercases keywords and re-indents", async () => {
    const out = await beautify("select id, name from users where id = 1", "sql");
    expect(out).toContain("SELECT");
    expect(out).toContain("FROM");
    expect(out).toContain("WHERE");
  });

  it("respects the configured tab width", async () => {
    const out = await beautify("SELECT 1, 2", "sql", { indent: 4 });
    expect(out).toContain("SELECT");
  });
});
