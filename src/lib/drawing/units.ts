// AutoCAD INSUNITS code → millimetres per drawing unit. Used to size the PDF
// page correctly when the user asks for "Fit to drawing": a drawing authored
// in metres should produce a multi-metre PDF, not a 1 mm box.
//
// libredwg-web's SVG output emits a viewBox in raw drawing units with no
// awareness of what those units mean, so we apply the multiplier ourselves.

import type { DwgDatabase } from "@mlightcad/libredwg-web";

// AutoCAD's $INSUNITS table (group code 70 in DXF). Only the unit codes we
// actually expect to see in user-supplied files; obscure ones (μin, parsecs)
// fall through to a 1:1 factor with a warning logged.
const MM_PER_UNIT: Record<number, number> = {
  0: 1, // Unspecified — treat as mm
  1: 25.4, // inch
  2: 304.8, // foot
  3: 1609344, // mile
  4: 1, // millimetre
  5: 10, // centimetre
  6: 1000, // metre
  7: 1_000_000, // kilometre
  9: 0.0254, // mil (1/1000 inch)
  10: 914.4, // yard
  14: 100, // decimetre
};

export function mmPerUnit(db: DwgDatabase | null): number {
  if (!db) return 1;
  const code = db.header.INSUNITS;
  if (code == null) return 1;
  return MM_PER_UNIT[code] ?? 1;
}
