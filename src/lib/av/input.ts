import { Input, BlobSource, ALL_FORMATS } from "mediabunny";

export function openInput(file: File | Blob): Input {
  return new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
}

export interface MediaMetadata {
  duration: number;
  width: number | null;
  height: number | null;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
}

export async function readMetadata(file: File | Blob): Promise<MediaMetadata> {
  const input = openInput(file);
  try {
    const [duration, videoTrack, audioTrack] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ]);
    let videoCodec: string | null = null;
    let audioCodec: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let audioSampleRate: number | null = null;
    let audioChannels: number | null = null;
    if (videoTrack) {
      videoCodec = await videoTrack.getCodec();
      width = await videoTrack.getDisplayWidth();
      height = await videoTrack.getDisplayHeight();
    }
    if (audioTrack) {
      audioCodec = await audioTrack.getCodec();
      audioSampleRate = await audioTrack.getSampleRate();
      audioChannels = await audioTrack.getNumberOfChannels();
    }
    return {
      duration,
      width,
      height,
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      videoCodec,
      audioCodec,
      audioSampleRate,
      audioChannels,
    };
  } finally {
    input.dispose?.();
  }
}
