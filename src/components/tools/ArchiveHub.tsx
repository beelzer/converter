import { Hub, type ModeSpec } from "../shared/Hub";
import ArchiveCreator from "./ArchiveCreator";
import ArchiveExtractor from "./ArchiveExtractor";

type Mode = "create" | "extract";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "create",
    label: "Create",
    blurb:
      "Bundle multiple files into a ZIP, TAR or TAR.GZ — or wrap a single file as GZIP. Done locally, no upload.",
  },
  {
    id: "extract",
    label: "Extract",
    blurb:
      "Drop ZIP, TAR, TAR.GZ, GZIP or RAR. Format is auto-detected from the file's magic bytes. Pick individual files or grab everything as a fresh ZIP.",
  },
];

export default function ArchiveHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="create"
      ariaLabel="Choose an archive operation"
      panels={{
        create: <ArchiveCreator />,
        extract: <ArchiveExtractor />,
      }}
    />
  );
}
