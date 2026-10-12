let current = 0xff;
let player: ((n: number) => void) | null = null;
let stopper: (() => void) | null = null;

export function setBgmBackend(play: (n: number) => void, stop: () => void) {
  player = play;
  stopper = stop;
  if (current < 0xff) play(current);
}

export function bgmPlay(n: number) {
  if (n >= 0xff) {
    stopper?.();
    current = 0xff;
    return;
  }
  if (n === current) return;
  current = n;
  stopper?.();
  player?.(n);
}
