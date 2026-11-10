import { synthesizeSlice, type FoodSound } from "./sound-design";
const foods: FoodSound[] = ["cucumber", "carrot", "salmon", "melon"];
const pentatonic = [0, 2, 4, 7, 9, 12, 14, 16];
export class SliceAudio {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers: AudioBuffer[][] = [];
  private enabled = true;
  private sources = new Set<AudioScheduledSourceNode>();
  unlock() {
    try {
      if (!this.context) {
        const context = new AudioContext({ latencyHint: "interactive" });
        this.context = context;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -13;
        compressor.knee.value = 9;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.11;
        this.output = context.createGain();
        this.output.gain.value = this.enabled ? 0.72 : 0;
        this.output.connect(compressor).connect(context.destination);
        this.buffers = foods.map((food) =>
          [0, 1, 2].map((variant) => {
            const samples = synthesizeSlice(context.sampleRate, food, variant);
            const buffer = context.createBuffer(
              1,
              samples.length,
              context.sampleRate,
            );
            buffer.getChannelData(0).set(samples);
            return buffer;
          }),
        );
      }
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Devices without Web Audio still keep their cut feedback. */
    }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.unlock();
    if (this.context && this.output)
      this.output.gain.setTargetAtTime(
        enabled ? 0.72 : 0,
        this.context.currentTime,
        0.008,
      );
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]) {
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      this.sources.delete(source);
    };
  }
  private note(
    frequency: number,
    at: number,
    volume: number,
    duration: number,
  ) {
    const context = this.context!,
      osc = context.createOscillator(),
      gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain).connect(this.output!);
    this.track(osc, [gain]);
    osc.start(at);
    osc.stop(at + duration + 0.01);
  }
  cut(foodIndex: number, combo: number, perfect: boolean, pan: number) {
    if (!this.enabled || !this.context || !this.output || !this.buffers.length)
      return;
    const context = this.context,
      now = context.currentTime;
    const source = context.createBufferSource(),
      gain = context.createGain(),
      panner = context.createStereoPanner();
    source.buffer = this.buffers[foodIndex][combo % 3];
    source.playbackRate.value = 1 + Math.min(combo, 30) * 0.0015;
    gain.gain.value = perfect ? 1.05 : 0.92;
    panner.pan.value = Math.max(-0.22, Math.min(0.22, pan));
    source.connect(gain).connect(panner).connect(this.output);
    this.track(source, [gain, panner]);
    source.start(now);
    if (combo >= 5) {
      const step = pentatonic[(combo - 5) % pentatonic.length],
        frequency = 523.25 * 2 ** (step / 12);
      this.note(frequency, now + 0.017, perfect ? 0.075 : 0.045, 0.21);
      if (combo >= 12) this.note(frequency * 2, now + 0.031, 0.025, 0.16);
      if (combo >= 25) this.note(frequency * 1.5, now + 0.045, 0.035, 0.24);
    }
    if ([5, 12, 25].includes(combo)) {
      [1, 1.25, 1.5, 2].forEach((ratio, i) =>
        this.note(660 * ratio, now + 0.035 + i * 0.035, 0.055, 0.32),
      );
    }
  }
  dispose() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.sources.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.output = null;
    this.buffers = [];
  }
}
