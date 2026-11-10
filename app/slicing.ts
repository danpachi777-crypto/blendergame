export const FOODS = [
  {
    id: "cucumber",
    name: "きゅうり",
    arrow: "↓",
    direction: [0, 1],
    color: 0xb8e765,
  },
  {
    id: "carrot",
    name: "にんじん",
    arrow: "↘",
    direction: [Math.SQRT1_2, Math.SQRT1_2],
    color: 0xffb35c,
  },
  {
    id: "salmon",
    name: "サーモン",
    arrow: "→",
    direction: [1, 0],
    color: 0xffa18b,
  },
  {
    id: "melon",
    name: "スイカ",
    arrow: "↙",
    direction: [-Math.SQRT1_2, Math.SQRT1_2],
    color: 0xff6c6d,
  },
] as const;
export function matchesDirection(
  dx: number,
  dy: number,
  direction: readonly number[],
) {
  const length = Math.hypot(dx, dy);
  return (
    length >= 30 && (dx * direction[0] + dy * direction[1]) / length > 0.78
  );
}
export function comboTier(combo: number) {
  return combo >= 25 ? 3 : combo >= 12 ? 2 : combo >= 5 ? 1 : 0;
}
export function cutScore(combo: number, perfect: boolean) {
  return Math.round((perfect ? 150 : 100) * (1 + Math.min(combo, 50) * 0.06));
}
