import { describe, expect, it } from "vitest";
import { MIME } from "./mime";

describe("MIME constants", () => {
  it("exports the catch-all MIME types used across the app", () => {
    expect(MIME.PDF).toBe("application/pdf");
    expect(MIME.ZIP).toBe("application/zip");
    expect(MIME.TAR).toBe("application/x-tar");
    expect(MIME.GZIP).toBe("application/gzip");
    expect(MIME.TEXT_PLAIN).toBe("text/plain");
    expect(MIME.TEXT_HTML).toBe("text/html");
    expect(MIME.TEXT_MARKDOWN).toBe("text/markdown");
    expect(MIME.TEXT_TYPESCRIPT).toBe("text/typescript");
    expect(MIME.JSON).toBe("application/json");
    expect(MIME.OCTET_STREAM).toBe("application/octet-stream");
  });
});
