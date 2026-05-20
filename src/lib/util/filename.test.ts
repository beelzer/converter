import { describe, expect, it } from "vitest";
import { EXT_CAPTURE, getExt, replaceExt, stripExt } from "./filename";

describe("filename.stripExt", () => {
  it("removes the trailing extension", () => {
    expect(stripExt("photo.jpg")).toBe("photo");
    expect(stripExt("archive.tar.gz")).toBe("archive.tar");
    expect(stripExt("UPPER.PNG")).toBe("UPPER");
  });

  it("leaves names without an extension unchanged", () => {
    expect(stripExt("README")).toBe("README");
    expect(stripExt("")).toBe("");
  });

  it("only treats trailing alphanum runs as extensions", () => {
    expect(stripExt("v1.2.beta")).toBe("v1.2");
    expect(stripExt("not.an extension here")).toBe("not.an extension here");
  });
});

describe("filename.getExt", () => {
  it("returns the lowercased extension", () => {
    expect(getExt("photo.JPG")).toBe("jpg");
    expect(getExt("archive.tar.gz")).toBe("gz");
  });

  it("returns null when there is no extension", () => {
    expect(getExt("README")).toBeNull();
    expect(getExt("")).toBeNull();
  });
});

describe("filename.replaceExt", () => {
  it("swaps the extension with or without a leading dot", () => {
    expect(replaceExt("photo.jpg", "png")).toBe("photo.png");
    expect(replaceExt("photo.jpg", ".png")).toBe("photo.png");
  });

  it("adds an extension to names that lacked one", () => {
    expect(replaceExt("README", "md")).toBe("README.md");
  });
});

describe("filename.EXT_CAPTURE", () => {
  it("is case-insensitive and only matches at end-of-string", () => {
    expect(EXT_CAPTURE.test("a.MP4")).toBe(true);
    expect(EXT_CAPTURE.test("a.mp4 extra")).toBe(false);
  });
});
