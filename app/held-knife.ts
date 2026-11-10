/** Camera-space grip anchored to the touch position; independent of the table camera. */
export function gripPosition(
  width: number,
  height: number,
  fov: number,
  depth: number,
  x: number,
  y: number,
): [number, number, number] {
  const halfHeight = Math.tan((fov * Math.PI) / 360) * depth;
  return [
    (((x / width) * 2 - 1) * halfHeight * width) / height,
    (1 - (y / height) * 2) * halfHeight,
    -depth,
  ];
}
