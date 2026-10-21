import type { PackedRect } from './pack-shelf.js';

// 형식 근거: Aseprite 시트 JSON 출력(json-hash, --list-tags) 소스
// https://github.com/aseprite/aseprite/blob/main/src/app/doc_exporter.cpp
// frames{name: {frame, rotated, trimmed, spriteSourceSize, sourceSize, duration}}, meta{app, version, image, format, size, scale, frameTags}

export interface SheetTag {
  name: string;
  /** 시트 프레임 순번(포함) */
  from: number;
  to: number;
  loop: boolean;
}

export interface AsepriteInput {
  image: string;
  size: { w: number; h: number };
  frames: readonly (PackedRect & { duration: number })[];
  tags: readonly SheetTag[];
  version: string;
}

export interface AsepriteFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
}

export interface AsepriteJson {
  frames: Record<string, AsepriteFrame>;
  meta: {
    app: string; version: string; image: string; format: 'RGBA8888'; size: { w: number; h: number }; scale: '1';
    frameTags: { name: string; from: number; to: number; direction: 'forward'; repeat?: string }[];
  };
}

/** Aseprite 호환 JSON(hash). 트리밍하지 않으므로 spriteSourceSize = 프레임 전체. 루프 아닌 태그는 repeat "1" */
export function asepriteJson(a: AsepriteInput): AsepriteJson {
  const frames: Record<string, AsepriteFrame> = {};
  for (const f of a.frames) {
    frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, duration: f.duration,
    };
  }
  return {
    frames,
    meta: {
      app: 'pixel-forge', version: a.version, image: a.image, format: 'RGBA8888', size: a.size, scale: '1',
      frameTags: a.tags.map((t) => ({ name: t.name, from: t.from, to: t.to, direction: 'forward' as const, ...(t.loop ? {} : { repeat: '1' }) })),
    },
  };
}
