import type { IndexedImage } from "../data/image.ts";

export const CHARACTER_CELLS = [...Array.from({ length: 33 }, (_, i) => i), 34, 36, 83, 84, 85, 86, 87, 88, 89, 90];

export function checkSheet(img: IndexedImage | undefined, paletteSize: number, rects: Int32Array, base: IndexedImage): string[] {
  if (!img) return ["KIRI.png 없음: 스마슈 그림으로 대신 표시"];
  const out: string[] = [];
  if (img.width !== 640 || img.height !== 272) out.push(`KIRI.png 크기 ${img.width}×${img.height} (640×272이어야 함)`);
  let over = 0;
  for (const v of img.pixels) if (v > 15) over++;
  if (over > 0) out.push(`KIRI.png 16번 이상 색 인덱스 ${over}px`);
  const inCell = new Uint8Array(img.width * img.height);
  for (let i = 0; i < rects.length / 4; i++) {
    const [l, t, r, b] = rects.subarray(i * 4, i * 4 + 4);
    for (let y = t; y < Math.min(b, img.height); y++) inCell.fill(1, y * img.width + l, y * img.width + Math.min(r, img.width));
  }
  const empty = CHARACTER_CELLS.filter((i) => {
    const [l, t, r, b] = rects.subarray(i * 4, i * 4 + 4);
    for (let y = t; y < Math.min(b, img.height); y++) {
      for (let x = l; x < Math.min(r, img.width); x++) if (img.pixels[y * img.width + x] !== 0) return false;
    }
    return true;
  });
  if (empty.length > 0) out.push(`빈 캐릭터 칸: ${empty.join(", ")}`);
  let stray = 0;
  const same = img.width === base.width && img.height === base.height;
  for (let p = 0; p < img.pixels.length; p++) {
    if (img.pixels[p] !== 0 && inCell[p] === 0 && !(same && base.pixels[p] !== 0)) stray++;
  }
  if (stray > 0) out.push(`칸 밖에 새로 그린 픽셀 ${stray}px`);
  return out;
}

export function checkFace(img: IndexedImage | undefined, paletteSize: number): string[] {
  if (!img) return ["KIRI_FACE.png 없음: 스마슈 초상화 그대로"];
  const out: string[] = [];
  if (img.width !== 128 || img.height !== 128) out.push(`KIRI_FACE.png 크기 ${img.width}×${img.height} (128×128이어야 함)`);
  let over = 0;
  for (const v of img.pixels) if (v > 15) over++;
  if (over > 0) out.push(`KIRI_FACE.png 16번 이상 색 인덱스 ${over}px (팔레트 ${paletteSize}색 중 앞 16색만 씀)`);
  return out;
}
