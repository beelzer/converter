// Bounding-box accumulator with per-entity tracking + outlier rejection.
//
// Each top-level entity is bracketed by `beginEntity()` so we can attribute
// expand() calls to a specific entity. After rendering finishes, the renderer
// asks for `outlierIndices()` to skip drawing entities whose bbox is wildly
// larger than the rest — those are usually transform-glitched entities that
// would otherwise overlay the entire drawing.

import type { BBox, Mat3 } from "./types";
import { transformPoint } from "./transform";

const EMPTY_BOX: BBox = { minX: NaN, minY: NaN, maxX: NaN, maxY: NaN };

export class Extents {
  // One entry per beginEntity() call. Aligned 1:1 with the renderer's
  // per-entity fragment array so callers can mask by index.
  private boxes: BBox[] = [];
  private current: BBox | null = null;
  private started = false;
  private rejectedNonFinite = 0;

  beginEntity(): void {
    if (this.started) {
      this.boxes.push(this.current ?? EMPTY_BOX);
    }
    this.current = null;
    this.started = true;
  }

  // Closes the last in-progress entity. Must be called once after the render
  // loop and before result() / outlierIndices().
  finalizeLastEntity(): void {
    if (this.started) {
      this.boxes.push(this.current ?? EMPTY_BOX);
      this.current = null;
      this.started = false;
    }
  }

  expand(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.rejectedNonFinite++;
      return;
    }
    if (!this.current) {
      this.current = { minX: x, minY: y, maxX: x, maxY: y };
      return;
    }
    if (x < this.current.minX) this.current.minX = x;
    if (y < this.current.minY) this.current.minY = y;
    if (x > this.current.maxX) this.current.maxX = x;
    if (y > this.current.maxY) this.current.maxY = y;
  }

  expandPoint(p: { x: number; y: number }, mat: Mat3): void {
    const t = transformPoint(mat, p.x, p.y);
    this.expand(t.x, t.y);
  }

  expandCircle(cx: number, cy: number, r: number, mat: Mat3): void {
    const t = transformPoint(mat, cx, cy);
    const sx = Math.abs(mat[0]) + Math.abs(mat[1]);
    const sy = Math.abs(mat[3]) + Math.abs(mat[4]);
    const rx = r * sx;
    const ry = r * sy;
    this.expand(t.x - rx, t.y - ry);
    this.expand(t.x + rx, t.y + ry);
  }

  // Indices in `boxes` whose entity bbox is dramatically larger than the
  // median entity. The renderer drops these from both the viewBox *and* the
  // emitted SVG so they don't paint over everything else.
  outlierIndices(): Set<number> {
    if (this.boxes.length < 4) return new Set();
    const diagonals = this.boxes.map((b) => boxDiagonal(b));
    const finiteDiagonals = diagonals.filter((d) => Number.isFinite(d) && d > 0);
    if (finiteDiagonals.length === 0) return new Set();
    const sorted = [...finiteDiagonals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;
    const threshold = Math.max(median * 100, 1);
    const out = new Set<number>();
    diagonals.forEach((d, i) => {
      if (Number.isFinite(d) && d > threshold) out.add(i);
    });
    return out;
  }

  result(outliers?: ReadonlySet<number>): BBox {
    const include = this.boxes.filter((b, i) => {
      if (!Number.isFinite(b.minX) || !Number.isFinite(b.minY)) return false;
      if (outliers && outliers.has(i)) return false;
      return true;
    });
    if (include.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };

    const combined: BBox = { ...include[0] };
    for (let i = 1; i < include.length; i++) {
      const b = include[i];
      if (b.minX < combined.minX) combined.minX = b.minX;
      if (b.minY < combined.minY) combined.minY = b.minY;
      if (b.maxX > combined.maxX) combined.maxX = b.maxX;
      if (b.maxY > combined.maxY) combined.maxY = b.maxY;
    }

    if (this.rejectedNonFinite > 0) {
      console.info(
        `[drawing] ${this.rejectedNonFinite} non-finite coordinate${this.rejectedNonFinite === 1 ? "" : "s"} rejected during render.`
      );
    }

    const padX = (combined.maxX - combined.minX) * 0.02 || 1;
    const padY = (combined.maxY - combined.minY) * 0.02 || 1;
    return {
      minX: combined.minX - padX,
      minY: combined.minY - padY,
      maxX: combined.maxX + padX,
      maxY: combined.maxY + padY,
    };
  }
}

function boxDiagonal(b: BBox): number {
  if (!Number.isFinite(b.minX)) return 0;
  return Math.hypot(b.maxX - b.minX, b.maxY - b.minY);
}
