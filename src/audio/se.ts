export class SoundEffects {
  private readonly cooldown = new Int32Array(10);
  private readonly pending = new Int32Array(10);

  constructor(
    private readonly ctx: AudioContext,
    private readonly buffers: AudioBuffer[],
  ) {}

  request(n: number) {
    const set = (ch: number) => {
      if (this.cooldown[ch] === 0) {
        this.pending[ch] = 1;
        this.cooldown[ch] = 2;
      }
    };
    switch (n) {
      case 0: set(1); break;
      case 1: set(6); break;
      case 2: set(1); set(6); break;
      case 3: set(3); break;
      case 4: set(2); break;
      case 5: set(0); break;
      case 6: set(5); break;
      case 7: set(4); break;
      case 8: set(7); set(9); break;
      case 9: set(9); break;
      case 10: set(8); break;
    }
  }

  frame() {
    for (let ch = 0; ch < 10; ch++) {
      if (this.pending[ch]) {
        this.pending[ch] = 0;
        this.play(ch);
      }
      if (this.cooldown[ch]) this.cooldown[ch]--;
    }
  }

  reset() {
    this.pending.fill(0);
  }

  private play(ch: number) {
    const buf = this.buffers[ch];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start();
  }
}
