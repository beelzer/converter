import { Hub, type ModeSpec } from "../shared/Hub";
import AvConverter from "./AvConverter";
import AvTrimmer from "./AvTrimmer";
import AvAudioExtractor from "./AvAudioExtractor";
import AvVideoToGif from "./AvVideoToGif";
import AvCompressor from "./AvCompressor";
import AvFrameExtractor from "./AvFrameExtractor";
import AvMerger from "./AvMerger";

type Mode = "convert" | "trim" | "audio" | "gif" | "compress" | "frames" | "merge";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "convert",
    label: "Convert",
    blurb: "Convert between MP4, WebM, MOV and MKV. Uses WebCodecs — no upload, no server.",
  },
  { id: "trim", label: "Trim", blurb: "Cut a clip to a specific start and end time." },
  {
    id: "audio",
    label: "Extract audio",
    blurb: "Pull the audio track out of a video as MP3, WAV, AAC, FLAC or Ogg.",
  },
  {
    id: "gif",
    label: "Video → GIF",
    blurb: "Make an animated GIF from a short video clip. Choose range, fps and width.",
  },
  {
    id: "compress",
    label: "Compress",
    blurb:
      "Shrink file size by re-encoding at a lower bitrate. Pick a light, medium or heavy preset.",
  },
  {
    id: "frames",
    label: "Frames",
    blurb: "Grab a single frame at a timestamp, or a series of frames at a fixed rate.",
  },
  {
    id: "merge",
    label: "Merge",
    blurb:
      "Stitch multiple clips end-to-end. Drag to reorder. Output normalises to a single resolution.",
  },
];

export default function AvHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="convert"
      ariaLabel="Choose an audio or video operation"
      panels={{
        convert: <AvConverter />,
        trim: <AvTrimmer />,
        audio: <AvAudioExtractor />,
        gif: <AvVideoToGif />,
        compress: <AvCompressor />,
        frames: <AvFrameExtractor />,
        merge: <AvMerger />,
      }}
    />
  );
}
