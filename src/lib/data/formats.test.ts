import { describe, expect, it } from "vitest";
import {
  ACCEPT_DATA,
  DATA_FORMATS,
  FORMAT_EXT,
  FORMAT_LABEL,
  FORMAT_MIME,
  detectFromFile,
  detectFromText,
} from "./formats";

describe("formats catalog", () => {
  it("lists all six supported formats", () => {
    expect(DATA_FORMATS).toEqual(["json", "yaml", "xml", "toml", "csv", "tsv"]);
  });

  it("has a label, extension, and mime for every format", () => {
    for (const f of DATA_FORMATS) {
      expect(FORMAT_LABEL[f]).toBeTruthy();
      expect(FORMAT_EXT[f]).toBeTruthy();
      expect(FORMAT_MIME[f]).toMatch(/\//);
    }
  });

  it("includes every extension in ACCEPT_DATA", () => {
    for (const f of DATA_FORMATS) {
      expect(ACCEPT_DATA.toLowerCase()).toContain(`.${FORMAT_EXT[f]}`);
    }
  });
});

describe("detectFromText", () => {
  it("identifies JSON object and array roots", () => {
    expect(detectFromText('{"a":1}')).toBe("json");
    expect(detectFromText("[1, 2, 3]")).toBe("json");
    expect(detectFromText("   \n{\n  \"a\": 1\n}\n")).toBe("json");
  });

  it("identifies XML by leading angle bracket", () => {
    expect(detectFromText("<?xml version=\"1.0\"?>\n<root/>")).toBe("xml");
    expect(detectFromText("<root>hi</root>")).toBe("xml");
  });

  it("identifies TOML by [section] or key = value", () => {
    expect(detectFromText("[server]\nport = 8080")).toBe("toml");
    expect(detectFromText("name = \"app\"")).toBe("toml");
  });

  it("identifies TSV when the first line has tabs but no commas", () => {
    expect(detectFromText("a\tb\tc\n1\t2\t3")).toBe("tsv");
  });

  it("identifies YAML when the first line is a mapping (colon)", () => {
    expect(detectFromText("name: app\nversion: 1.0")).toBe("yaml");
  });

  it("falls back to CSV when there are only commas", () => {
    expect(detectFromText("a,b,c\n1,2,3")).toBe("csv");
  });

  it("returns null on empty input", () => {
    expect(detectFromText("")).toBeNull();
    expect(detectFromText("   \n\n")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(detectFromText("just a plain sentence with no delimiters")).toBeNull();
  });

  it("doesn't promote invalid JSON to JSON", () => {
    // Starts with { but isn't valid JSON, and the line has no other format
    // signals — null is the honest answer.
    expect(detectFromText("{ not really json")).toBeNull();
  });
});

describe("detectFromFile", () => {
  const file = (name: string) => new File([""], name, { type: "" });

  it("maps each extension to the right format", () => {
    expect(detectFromFile(file("a.json"))).toBe("json");
    expect(detectFromFile(file("a.YAML"))).toBe("yaml");
    expect(detectFromFile(file("a.yml"))).toBe("yaml");
    expect(detectFromFile(file("a.xml"))).toBe("xml");
    expect(detectFromFile(file("a.toml"))).toBe("toml");
    expect(detectFromFile(file("a.csv"))).toBe("csv");
    expect(detectFromFile(file("a.tsv"))).toBe("tsv");
  });

  it("returns null for unknown extensions", () => {
    expect(detectFromFile(file("notes.txt"))).toBeNull();
    expect(detectFromFile(file("no-extension"))).toBeNull();
  });
});
