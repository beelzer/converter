import { Hub, type ModeSpec } from "../shared/Hub";
import ImageConverter from "./ImageConverter";
import ImageResizer from "./ImageResizer";
import ImageCompressor from "./ImageCompressor";
import FaviconGenerator from "./FaviconGenerator";
import ExifStripper from "./ExifStripper";
import SvgRasterizer from "./SvgRasterizer";

type Mode = "convert" | "resize" | "compress" | "favicon" | "exif" | "svg";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "convert",
    label: "Convert",
    blurb: "Convert images between JPG, PNG, WebP, AVIF, GIF, BMP, TIFF and HEIC.",
  },
  {
    id: "resize",
    label: "Resize",
    blurb: "Shrink an image to fit within a max width and height. Aspect ratio preserved.",
  },
  {
    id: "compress",
    label: "Compress",
    blurb:
      "Re-encode images at a chosen quality to shrink file size. JPG/WebP/AVIF stay in their format; lossless inputs convert to WebP.",
  },
  {
    id: "favicon",
    label: "Favicon",
    blurb:
      "Generate a complete favicon bundle (ICO + multi-size PNGs + manifest) from one source image.",
  },
  {
    id: "exif",
    label: "Strip EXIF",
    blurb: "Remove EXIF metadata (camera, GPS, timestamps) from a JPG without re-encoding the pixels.",
  },
  {
    id: "svg",
    label: "SVG → Raster",
    blurb: "Rasterize an SVG into PNG, JPG or WebP at any width.",
  },
];

export default function ImageHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="convert"
      ariaLabel="Choose an image operation"
      panels={{
        convert: <ImageConverter />,
        resize: <ImageResizer />,
        compress: <ImageCompressor />,
        favicon: <FaviconGenerator />,
        exif: <ExifStripper />,
        svg: <SvgRasterizer />,
      }}
    />
  );
}
