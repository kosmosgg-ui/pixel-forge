import { PNG, type PNGOptions } from 'pngjs';

// 바이트 결정론: 압축·필터·색 형식을 고정하고 gAMA 등 메타데이터 청크를 쓰지 않는다
const WRITE_OPTIONS = {
  deflateLevel: 9,
  filterType: 0,
  colorType: 6,
  inputColorType: 6,
  inputHasAlpha: true,
  bitDepth: 8,
} as const satisfies PNGOptions;

export interface RgbaImage {
  w: number;
  h: number;
  rgba: Uint8Array;
}

export function encodePng({ w, h, rgba }: RgbaImage): Buffer {
  const png = new PNG({ width: w, height: h, ...WRITE_OPTIONS });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  return PNG.sync.write(png, WRITE_OPTIONS);
}

export function decodePng(buf: Buffer): RgbaImage {
  const png = PNG.sync.read(buf);
  return { w: png.width, h: png.height, rgba: new Uint8Array(png.data) };
}

/** 청크 이름 목록 (검증용) */
export function pngChunks(buf: Buffer): string[] {
  const out: string[] = [];
  for (let p = 8; p + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(p);
    out.push(buf.toString('latin1', p + 4, p + 8));
    p += 12 + len;
  }
  return out;
}
