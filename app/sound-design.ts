/** Short, layered Foley-style cuts. Generated locally; no audio downloads. */
export type FoodSound = "cucumber" | "carrot" | "salmon" | "melon";
const profiles: Record<
  FoodSound,
  { crunch: number; wet: number; body: number; brightness: number }
> = {
  cucumber: { crunch: 0.72, wet: 0.35, body: 0.18, brightness: 4400 },
  carrot: { crunch: 0.92, wet: 0.08, body: 0.31, brightness: 3000 },
  salmon: { crunch: 0.13, wet: 0.58, body: 0.12, brightness: 1900 },
  melon: { crunch: 0.45, wet: 0.88, body: 0.23, brightness: 3700 },
};
export function synthesizeSlice(
  sampleRate: number,
  food: FoodSound,
  variant = 0,
): Float32Array {
  const duration = 0.34,
    result = new Float32Array(Math.ceil(duration * sampleRate));
  const p = profiles[food];
  let seed =
    (0x731a29 + variant * 7919 + Object.keys(profiles).indexOf(food) * 3191) >>>
    0;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2147483648 - 1;
  };
  let low = 0,
    previousNoise = 0,
    juice = 0;
  const cutoff = 1 - Math.exp((-2 * Math.PI * p.brightness) / sampleRate);
  const tune = 1 + (variant - 1) * 0.035;
  for (let i = 0; i < result.length; i++) {
    const t = i / sampleRate,
      n = random();
    low += cutoff * (n - low);
    juice += 0.13 * (n - juice);
    const high = n - previousNoise;
    previousNoise = n;
    // A short blade sweep precedes the contact, so the attack feels physical.
    const sweep =
      (n - low) *
      Math.sin(Math.PI * Math.min(t / 0.055, 1)) ** 2 *
      Math.exp(-t * 55) *
      0.16;
    const age = Math.max(0, t - 0.009),
      contact = t >= 0.009 ? 1 : 0;
    const attack =
      contact *
      (high * 0.26 + Math.sin(2 * Math.PI * 2350 * tune * age) * 0.16) *
      Math.exp(-age * 160);
    // Uneven micro fractures instead of a single sustained hiss.
    const fracture = [0, 0.011, 0.027, 0.048, 0.074].reduce(
      (sum, offset, k) => {
        const a = age - offset;
        return a >= 0
          ? sum + Math.exp(-a * (100 + k * 17)) * (1 - k * 0.13)
          : sum;
      },
      0,
    );
    const crunch = contact * low * fracture * p.crunch * 0.34;
    const wet =
      contact *
      (juice * 2.3 +
        Math.sin(2 * Math.PI * (570 * age - 900 * age * age)) *
          Math.exp(-age * 45) *
          0.18) *
      Math.exp(-age * 23) *
      p.wet *
      0.48;
    // Three damped wood resonances: a low thock with a small, audible phone-speaker knock.
    const wood =
      contact *
      (Math.sin(2 * Math.PI * 151 * tune * age) * Math.exp(-age * 40) +
        0.48 * Math.sin(2 * Math.PI * 463 * tune * age) * Math.exp(-age * 68) +
        0.22 * Math.sin(2 * Math.PI * 917 * age) * Math.exp(-age * 110)) *
      p.body;
    const steel =
      contact *
      Math.sin(2 * Math.PI * 4650 * tune * age) *
      Math.exp(-age * 95) *
      0.022;
    const fade = Math.min(1, t / 0.002) * Math.min(1, (duration - t) / 0.025);
    result[i] =
      Math.tanh((sweep + attack + crunch + wet + wood + steel) * 1.75) * fade;
  }
  // Very short room reflections, keeping the next cut clear.
  const dry = result.slice();
  for (let i = 0; i < result.length; i++) {
    const d1 = i - Math.round(sampleRate * 0.019),
      d2 = i - Math.round(sampleRate * 0.043);
    result[i] =
      dry[i] + (d1 >= 0 ? dry[d1] * 0.1 : 0) + (d2 >= 0 ? dry[d2] * 0.045 : 0);
  }
  let peak = 0;
  for (const value of result) peak = Math.max(peak, Math.abs(value));
  const gain = 0.84 / Math.max(0.84, peak);
  for (let i = 0; i < result.length; i++) result[i] *= gain;
  return result;
}
