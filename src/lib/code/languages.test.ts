import { describe, expect, it } from "vitest";
import {
  BEAUTIFY_LANGUAGES,
  LANGUAGE_EXT,
  LANGUAGE_LABEL,
  LANGUAGE_MIME,
  MINIFY_LANGUAGES,
  detectFromFile,
} from "./languages";

const fileWith = (name: string) => new File([new Uint8Array(0)], name, { type: "" });

describe("language catalog", () => {
  it("has a label, extension, and mime for every beautify language", () => {
    for (const lang of BEAUTIFY_LANGUAGES) {
      expect(LANGUAGE_LABEL[lang]).toBeTruthy();
      expect(LANGUAGE_EXT[lang]).toBeTruthy();
      expect(LANGUAGE_MIME[lang]).toMatch(/\//);
    }
  });

  it("MINIFY_LANGUAGES is a subset of BEAUTIFY_LANGUAGES", () => {
    for (const lang of MINIFY_LANGUAGES) {
      expect(BEAUTIFY_LANGUAGES).toContain(lang);
    }
  });
});

describe("detectFromFile", () => {
  it("maps common extensions to their language", () => {
    expect(detectFromFile(fileWith("a.js"))).toBe("javascript");
    expect(detectFromFile(fileWith("a.mjs"))).toBe("javascript");
    expect(detectFromFile(fileWith("a.cjs"))).toBe("javascript");
    expect(detectFromFile(fileWith("a.jsx"))).toBe("javascript");
    expect(detectFromFile(fileWith("a.ts"))).toBe("typescript");
    expect(detectFromFile(fileWith("a.tsx"))).toBe("typescript");
    expect(detectFromFile(fileWith("a.JSON"))).toBe("json");
    expect(detectFromFile(fileWith("a.css"))).toBe("css");
    expect(detectFromFile(fileWith("a.scss"))).toBe("scss");
    expect(detectFromFile(fileWith("a.sass"))).toBe("scss");
    expect(detectFromFile(fileWith("a.less"))).toBe("less");
    expect(detectFromFile(fileWith("a.html"))).toBe("html");
    expect(detectFromFile(fileWith("a.htm"))).toBe("html");
    expect(detectFromFile(fileWith("a.vue"))).toBe("vue");
    expect(detectFromFile(fileWith("a.md"))).toBe("markdown");
    expect(detectFromFile(fileWith("a.yaml"))).toBe("yaml");
    expect(detectFromFile(fileWith("a.yml"))).toBe("yaml");
    expect(detectFromFile(fileWith("a.gql"))).toBe("graphql");
    expect(detectFromFile(fileWith("a.sql"))).toBe("sql");
  });

  it("returns null for unknown extensions or no extension", () => {
    expect(detectFromFile(fileWith("notes.txt"))).toBeNull();
    expect(detectFromFile(fileWith("README"))).toBeNull();
  });
});
