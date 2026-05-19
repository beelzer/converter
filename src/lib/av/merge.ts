import {
  Output,
  BufferTarget,
  CanvasSource,
  AudioSampleSource,
  CanvasSink,
  AudioSampleSink,
  QUALITY_HIGH,
} from "mediabunny";
import { openInput } from "./input";
import {
  videoContainerOutput,
  VIDEO_CODEC_FOR_CONTAINER,
  AUDIO_CODEC_FOR_CONTAINER,
  type VideoContainer,
} from "./formats";

export interface MergeOptions {
  container: VideoContainer;
  width?: number;
  height?: number;
  onProgress?: (p: number) => void;
}

export async function mergeClips(files: File[], options: MergeOptions): Promise<Uint8Array> {
  if (files.length === 0) throw new Error("No clips to merge.");

  const firstInput = openInput(files[0]);
  let targetW = options.width ?? 1280;
  let targetH = options.height ?? 720;
  let hasAnyAudio = false;
  try {
    const firstVideo = await firstInput.getPrimaryVideoTrack();
    if (firstVideo) {
      targetW = options.width ?? (await firstVideo.getDisplayWidth());
      targetH = options.height ?? (await firstVideo.getDisplayHeight());
    }
    hasAnyAudio = !!(await firstInput.getPrimaryAudioTrack());
  } finally {
    firstInput.dispose?.();
  }

  if (!hasAnyAudio) {
    for (const f of files.slice(1)) {
      const input = openInput(f);
      try {
        if (await input.getPrimaryAudioTrack()) {
          hasAnyAudio = true;
          break;
        }
      } finally {
        input.dispose?.();
      }
    }
  }

  const output = new Output({
    format: videoContainerOutput(options.container),
    target: new BufferTarget(),
  });

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create OffscreenCanvas 2D context.");

  const videoSource = new CanvasSource(canvas, {
    codec: VIDEO_CODEC_FOR_CONTAINER[options.container],
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource);

  const audioSource = hasAnyAudio
    ? new AudioSampleSource({
        codec: AUDIO_CODEC_FOR_CONTAINER[options.container],
        bitrate: QUALITY_HIGH,
        transform: { numberOfChannels: 2, sampleRate: 48000 },
      })
    : null;
  if (audioSource) output.addAudioTrack(audioSource);

  await output.start();

  let timeOffset = 0;
  let totalDuration = 0;
  const durations: number[] = [];
  for (const f of files) {
    const probe = openInput(f);
    try {
      const d = await probe.computeDuration();
      durations.push(d);
      totalDuration += d;
    } finally {
      probe.dispose?.();
    }
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const input = openInput(file);
    try {
      const videoTrack = await input.getPrimaryVideoTrack();
      const audioTrack = await input.getPrimaryAudioTrack();

      if (videoTrack) {
        const sink = new CanvasSink(videoTrack, {
          width: targetW,
          height: targetH,
          fit: "contain",
        });
        for await (const wrapped of sink.canvases()) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(wrapped.canvas, 0, 0, targetW, targetH);
          await videoSource.add(timeOffset + wrapped.timestamp, wrapped.duration);
          if (options.onProgress && totalDuration > 0) {
            options.onProgress(Math.min(0.99, (timeOffset + wrapped.timestamp) / totalDuration));
          }
        }
      } else {
        const framesPerSec = 24;
        const dt = 1 / framesPerSec;
        const dur = durations[i];
        for (let t = 0; t < dur; t += dt) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, targetW, targetH);
          await videoSource.add(timeOffset + t, dt);
        }
      }

      if (audioTrack && audioSource) {
        const sink = new AudioSampleSink(audioTrack);
        for await (const sample of sink.samples()) {
          sample.setTimestamp(timeOffset + sample.timestamp);
          await audioSource.add(sample);
          sample.close();
        }
      }
      timeOffset += durations[i];
    } finally {
      input.dispose?.();
    }
  }

  await output.finalize();
  options.onProgress?.(1);
  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Merge produced no output.");
  return new Uint8Array(buffer);
}
