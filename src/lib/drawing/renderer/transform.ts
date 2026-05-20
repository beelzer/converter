// 3×3 affine matrix helpers for block insertions. Each INSERT entity applies
// translate(insertionPoint) · rotate(rotation) · scale(xScale,yScale) on top
// of the parent space's matrix, and child entities (potentially more INSERTs)
// inherit the product.

import type { Mat3 } from "./types";
import { IDENTITY_MAT } from "./types";

export function multiply(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

export function translation(tx: number, ty: number): Mat3 {
  return [1, 0, tx, 0, 1, ty, 0, 0, 1];
}

export function rotation(angle: number): Mat3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function scale(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
}

export function transformPoint(mat: Mat3, x: number, y: number): { x: number; y: number } {
  return {
    x: mat[0] * x + mat[1] * y + mat[2],
    y: mat[3] * x + mat[4] * y + mat[5],
  };
}

// Decomposed scale magnitude — used for lineweight + radius scaling under an
// INSERT. We take sqrt(det) so non-uniform scales degrade gracefully into a
// single representative factor.
export function scaleMagnitude(mat: Mat3): number {
  const det = mat[0] * mat[4] - mat[1] * mat[3];
  return Math.sqrt(Math.abs(det)) || 1;
}

export function matrixToSvg(mat: Mat3): string {
  if (matEquals(mat, IDENTITY_MAT)) return "";
  return `matrix(${fmt(mat[0])},${fmt(mat[3])},${fmt(mat[1])},${fmt(mat[4])},${fmt(mat[2])},${fmt(mat[5])})`;
}

function matEquals(a: Mat3, b: Mat3): boolean {
  for (let i = 0; i < 9; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? Number(n.toFixed(6)).toString() : "0";
}
