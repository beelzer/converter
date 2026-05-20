// Dispatches a single entity to the right renderer based on its type tag.
// All entity renderers share this signature; the dimension and insert
// renderers receive the dispatcher itself for their recursion.

import type {
  DwgArcEntity,
  DwgCircleEntity,
  DwgDimensionEntity,
  DwgEllipseEntity,
  DwgEntity,
  DwgHatchEntity,
  DwgInsertEntity,
  DwgLeaderEntity,
  DwgLineEntity,
  DwgLWPolylineEntity,
  DwgMTextEntity,
  DwgPointEntity,
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
  DwgSolidEntity,
  DwgSplineEntity,
  DwgTextEntity,
  DwgWipeoutEntity,
} from "@mlightcad/libredwg-web";
import { Extents } from "../extents";
import type { Mat3, RenderContext } from "../types";
import { renderLine } from "./line";
import { renderCircle } from "./circle";
import { renderArc } from "./arc";
import { renderEllipse } from "./ellipse";
import { renderPoint } from "./point";
import { renderSolid } from "./solid";
import { renderLwPolyline } from "./lwpolyline";
import { renderPolyline2d, renderPolyline3d } from "./polyline";
import { renderSpline } from "./spline";
import { renderText } from "./text";
import { renderMText } from "./mtext";
import { renderLeader } from "./leader";
import { renderWipeout } from "./wipeout";
import { renderHatch } from "./hatch";
import { renderDimension } from "./dimension";
import { renderInsert } from "./insert";

export function renderEntity(
  entity: DwgEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents,
  patternIdCounter: { next: number }
): string {
  switch (entity.type) {
    case "LINE":
      return renderLine(entity as DwgLineEntity, ctx, mat, extents);
    case "CIRCLE":
      return renderCircle(entity as DwgCircleEntity, ctx, mat, extents);
    case "ARC":
      return renderArc(entity as DwgArcEntity, ctx, mat, extents);
    case "ELLIPSE":
      return renderEllipse(entity as DwgEllipseEntity, ctx, mat, extents);
    case "POINT":
      return renderPoint(entity as DwgPointEntity, ctx, mat, extents);
    case "SOLID":
    case "TRACE":
      return renderSolid(entity as DwgSolidEntity, ctx, mat, extents);
    case "LWPOLYLINE":
      return renderLwPolyline(entity as DwgLWPolylineEntity, ctx, mat, extents);
    case "POLYLINE2D":
    case "POLYLINE":
      return renderPolyline2d(entity as DwgPolyline2dEntity, ctx, mat, extents);
    case "POLYLINE3D":
      return renderPolyline3d(entity as DwgPolyline3dEntity, ctx, mat, extents);
    case "SPLINE":
      return renderSpline(entity as DwgSplineEntity, ctx, mat, extents);
    case "TEXT":
      return renderText(entity as DwgTextEntity, ctx, mat, extents);
    case "MTEXT":
      return renderMText(entity as DwgMTextEntity, ctx, mat, extents);
    case "LEADER":
      return renderLeader(entity as DwgLeaderEntity, ctx, mat, extents);
    case "WIPEOUT":
      return renderWipeout(entity as DwgWipeoutEntity, mat, extents);
    case "HATCH":
      return renderHatch(entity as DwgHatchEntity, ctx, mat, extents, patternIdCounter);
    case "DIMENSION":
      return renderDimension(
        entity as DwgDimensionEntity,
        ctx,
        mat,
        extents,
        renderEntity,
        patternIdCounter
      );
    case "INSERT":
      return renderInsert(
        entity as DwgInsertEntity,
        ctx,
        mat,
        extents,
        renderEntity,
        patternIdCounter
      );
    default:
      // 3DFACE, VIEWPORT, IMAGE, OLE, RAY, XLINE, MLINE, ATTDEF, TOLERANCE,
      // MLEADER, etc. — silently skip. Rendering them properly would require
      // per-type handlers we haven't written yet; emitting nothing is safer
      // than emitting incorrect geometry.
      return "";
  }
}
