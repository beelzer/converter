# /drawing test fixtures

Public DWG / DXF samples for testing the CAD converter. All from
[libredwg's test-data tree](https://cgit.git.savannah.gnu.org/cgit/libredwg.git/tree/test/test-data)
(GPL-3.0; safe for testing, not redistributed in the production bundle).

## Quick iteration

- **sample_2000.dwg** (22 KB) — smallest. Parse + render in well under a
  second. Use this when debugging the dispatcher.
- **sample_2018.dwg** (20 KB) — same drawing, newest format. Use to confirm
  the parser handles 2018-format opcodes.

## Full-feature drawings

- **example_2000.dwg** (569 KB) — architectural-style drawing with many
  entity types. Use to exercise hatches, dimensions, blocks, text.
- **example_2000.dxf** (1.4 MB) — same content as DXF. Use to check the DXF
  parse path independently of DWG.
- **example_2007.dwg** (446 KB) — 2007 format coverage.
- **example_2018.dwg** (146 KB), **example_2018.dxf** (826 KB) — latest
  format. The DXF is bigger because it's the verbose ASCII form.
- **example_r14.dwg** (430 KB) — legacy R14 format. Tests the parser's
  handling of pre-2000 binary layouts.

## What to look for during testing

| Failure shape | Likely cause |
|---|---|
| Whole drawing missing | parse error → check console; format too new for libredwg |
| Lines render but no text | TEXT/MTEXT dispatcher fell through or threw |
| Hatches show as empty outlines | hatch entity dispatcher / boundary path edge type missing |
| Dimensions missing | the pre-baked dimension block reference (`entity.name`) didn't resolve |
| Splines straight | de Boor evaluator hitting an empty knot vector |
| Stroke widths wrong | lineweight enum lookup not finding the right valid value |
| Linetypes solid when they should be dashed | LTYPE table miss / linetype scale wrong |
| Block insert wrong position | INSERT matrix composition order |
| INSERT rendering nothing | block lookup miss / recursion-depth limit hit |

## Not included

- Drawings with **CTB plot styles** — hard to source as public files. Try
  exporting a CTB from AutoCAD locally, or bundle a `.dwg + .ctb` ZIP from
  the project share for a specific firm's drawings.
- **Hatches with custom patterns** — most public samples use solid fills
  only. Mechanical drawings (ANSI31 cross-hatching) are the best stress.
- **Mleader / Image / Wipeout** — silently skipped by the renderer in v1.
