import { setBgmBackend } from "./bgm.ts";

export interface TrackInfo {
  url: string;
  loop: { start: number; end: number } | null;
}

export function startMusic(ctx: AudioContext, tracks: TrackInfo[]) {
  const cache = new Map<number, Promise<AudioBuffer>>();
  let source: AudioBufferSourceNode | null = null;
  let request = 0;
  const load = (n: number) => {
    let p = cache.get(n);
    if (!p) {
      p = fetch(tracks[n].url)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b));
      cache.set(n, p);
    }
    return p;
  };
  const stop = () => {
    request++;
    if (!source) return;
    source.stop();
    source.disconnect();
    source = null;
  };
  setBgmBackend(
    (n) => {
      stop();
      const info = tracks[n];
      if (!info) return;
      const mine = request;
      load(n)
        .then((buffer) => {
          if (mine !== request) return;
          const node = ctx.createBufferSource();
          node.buffer = buffer;
          if (info.loop) {
            node.loop = true;
            node.loopStart = info.loop.start;
            node.loopEnd = info.loop.end;
          }
          node.connect(ctx.destination);
          node.start();
          source = node;
        })
        .catch((e) => console.warn("BGM", e));
    },
    stop,
  );
}
