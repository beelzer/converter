import { describe, expect, it, vi } from "vitest";
import { downloadBlob, formatSize, newId } from "./file";

describe("formatSize", () => {
  it("renders bytes in B / KB / MB depending on magnitude", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1023)).toBe("1023 B");
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1024 * 1024 - 1)).toBe("1024.0 KB");
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(1024 * 1024 * 5.25)).toBe("5.3 MB");
  });
});

describe("newId", () => {
  it("returns a short base-36 string", () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-z]{1,8}$/);
  });

  it("returns different values on subsequent calls (with overwhelming probability)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(newId());
    // 50 random 8-char base-36 strings should be unique in practice.
    expect(ids.size).toBeGreaterThan(45);
  });
});

describe("downloadBlob", () => {
  it("creates an object URL, clicks an anchor, and schedules revocation", () => {
    const created: string[] = [];
    const revoked: string[] = [];
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob: Blob | MediaSource) => {
        const url = `blob:mock-${created.length}`;
        created.push(`${(blob as Blob).type ?? ""}`);
        return url;
      });
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation((url: string) => {
        revoked.push(url);
      });
    vi.useFakeTimers();

    try {
      const blob = new Blob(["hello"], { type: "text/plain" });
      downloadBlob(blob, "hello.txt", "text/plain");
      expect(createSpy).toHaveBeenCalledOnce();

      // The anchor is removed immediately after click; revoke is delayed.
      expect(revoked.length).toBe(0);
      vi.advanceTimersByTime(2000);
      expect(revoked.length).toBe(1);
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("wraps raw Uint8Array bytes in a Blob with the supplied mime", () => {
    let received: Blob | null = null;
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob: Blob | MediaSource) => {
        received = blob as Blob;
        return "blob:mock";
      });
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    try {
      downloadBlob(new Uint8Array([1, 2, 3]), "out.bin", "application/octet-stream");
      expect(received).not.toBeNull();
      expect(received!.type).toBe("application/octet-stream");
      expect(received!.size).toBe(3);
    } finally {
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});
