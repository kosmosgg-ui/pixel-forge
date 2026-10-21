# 게임 연동 (엔진 무관)

pixel-forge 산출물은 **시트 PNG 1장 + Aseprite 호환 JSON + manifest** 세 파일이다. 대부분의 엔진·프레임워크(Phaser, PixiJS, LÖVE, Unity·Godot용 Aseprite 임포터 등)는 Aseprite 시트 JSON을 그대로 읽는다. 엔진 전용 포맷은 만들지 않는다.

## 만드는 법

```
pnpm forge build data/specs/<project>/<id>.spec.json        # QA 통과 시 out/<id>/에 pack
pnpm forge apply data/specs/<project>/<id>.spec.json --target dir --out <게임 폴더>
pnpm forge watch <project> --target dir --out <게임 폴더>    # Spec·바이블·애니·규칙 저장 → 해당 캐릭터만 다시 build → apply
```

- `--out`은 작업 폴더(forge를 실행한 폴더) 기준 상대 경로이고, 그 밖으로는 쓰지 않는다(`io.path-escape`). 바이블에 `"apply": { "out": "..." }`를 두면 `--out`을 생략할 수 있다.
- 게임 저장소가 작업 폴더 밖에 있으면 허용 목록 `.forge/targets.local.json`(gitignore, **사람이 직접 작성**)에 `{ "targets": { "game": "/절대/경로/assets/sprites" } }`처럼 이름을 등록하고 `--out @game`으로 이름만 참조한다. 목록에 없는 이름·바깥 경로는 `io.path-escape`. 대상 안의 `<id>/`·파일이 심볼릭 링크면 따라가지 않고 거부한다.
- `<out>/<id>/` 아래 파일만 쓴다. forge가 쓴 파일은 `.forge-files.json`에 해시로 기록되고, 기록에 없거나 사람이 고친 같은 이름 파일이 있으면 아무것도 덮어쓰지 않고 exit 1(`apply.foreign-file`)로 멈춘다.
- QA 불합격이면 복사하지 않는다(exit 2). 시각 검수 기록 `out/<id>/review.json`(pixel-reviewer가 `forge review-score`로 남김, 18/24 이상, 지금 입력으로 채점)이 없거나 미달이어도 복사하지 않는다(exit 2). 개발 중 watch 루프처럼 검수 없이 넣어 보려면 `--skip-review`를 명시한다.

## 파일

| 파일 | 내용 |
| --- | --- |
| `<id>.png` | 모든 프레임을 담은 시트. RGBA, 알파 0/255, 프레임 사이·가장자리 1px 빈 칸 |
| `<id>.json` | Aseprite 호환 JSON(hash 형식). 형식 근거: [Aseprite doc_exporter.cpp](https://github.com/aseprite/aseprite/blob/main/src/app/doc_exporter.cpp) |
| `manifest.json` | 애니별 프레임·ms·loop, 발밑 기준점, 절차 애니 힌트(motion), 사용 색, 시트 해시 |

### `<id>.json`

```jsonc
{
  "frames": {
    "idle_r_0": { "frame": { "x": 1, "y": 1, "w": 48, "h": 48 }, "rotated": false, "trimmed": false,
                  "spriteSourceSize": { "x": 0, "y": 0, "w": 48, "h": 48 }, "sourceSize": { "w": 48, "h": 48 }, "duration": 180 }
  },
  "meta": { "app": "pixel-forge", "version": "0.5.0", "image": "rogue.png", "format": "RGBA8888", "size": { "w": 197, "h": 246 }, "scale": "1",
            "frameTags": [ { "name": "idle_r", "from": 1, "to": 4, "direction": "forward" }, { "name": "death_r", "from": 14, "to": 17, "direction": "forward", "repeat": "1" } ] }
}
```

- 프레임 이름 `<anim>_<dir>_<n>`, 태그 `<anim>_<dir>`. 시트는 **우향(`r`)만** 담는다. 좌향은 엔진에서 좌우 반전(scaleX = -1)하면 픽셀 단위로 같다.
- `from`·`to`는 `frames`의 키 순서(0부터) 기준, 양끝 포함. `repeat: "1"`이 있으면 한 번 재생 후 마지막 프레임에서 멈춘다(death 등). 없으면 반복.
- `rest_r`(1프레임, duration 100)은 기본 자세. 메뉴·초상·정지 상태에 쓴다.
- 트리밍하지 않는다: 모든 프레임이 같은 크기이고 `spriteSourceSize`는 프레임 전체.

### `manifest.json`

```jsonc
{ "id": "rogue", "bible": "sample-v0", "sizeClass": "character", "frameSize": [48, 48],
  "pivot": [24, 47],            // 발밑 기준점: 이 점을 캐릭터 위치에 맞추면 모든 프레임에서 발이 고정
  "facing": "r",
  "anims": { "idle": { "frames": ["idle_r_0", "..."], "ms": [180, 180, 180, 180], "loop": true } },
  "motion": { "bob": { "px": 1, "ms": 400 }, "squash": { "x": 1.1, "y": 0.9, "ms": 80 }, "hitFlash": { "ms": 60 } },
  "palette": ["#..."], "hash": "<시트 PNG SHA-256>" }
```

- `motion`은 엔진이 코드로 실행할 절차 애니 힌트다(걷기 상하 흔들림·착지 찌그러짐·피격 깜빡임). 툴은 값만 적고 프레임을 만들지 않는다.
- 확대는 반드시 **최근접(nearest)** 으로. 보간 필터를 켜면 도트가 번진다.

## 순수 JS 로더 예시 (Canvas 2D)

```js
// 사용: const s = await loadSprite('game/rogue/', 'rogue'); s.draw(ctx, 'attack', t, x, y, { left: true, scale: 3 });
export async function loadSprite(base, id) {
  const [data, manifest] = await Promise.all(
    [`${id}.json`, 'manifest.json'].map((f) => fetch(base + f).then((r) => r.json())));
  const img = new Image();
  img.src = base + data.meta.image;
  await img.decode();
  const names = Object.keys(data.frames);
  const anims = {};
  for (const tag of data.meta.frameTags) {
    const frames = names.slice(tag.from, tag.to + 1).map((n) => data.frames[n]);
    anims[tag.name.replace(/_r$/, '')] = { frames, loop: tag.repeat === undefined, total: frames.reduce((a, f) => a + f.duration, 0) };
  }
  const [px, py] = manifest.pivot;
  return {
    manifest,
    /** t = 애니 시작 후 경과 ms. (x, y) = 발밑 위치 */
    draw(ctx, anim, t, x, y, { left = false, scale = 1 } = {}) {
      const a = anims[anim];
      let ms = a.loop ? t % a.total : Math.min(t, a.total - 1);
      const f = a.frames.find((fr) => (ms -= fr.duration) < 0) ?? a.frames[a.frames.length - 1];
      const { x: sx, y: sy, w, h } = f.frame;
      ctx.save();
      ctx.imageSmoothingEnabled = false; // 최근접 확대
      ctx.translate(x, y);
      ctx.scale(left ? -scale : scale, scale);
      ctx.drawImage(img, sx, sy, w, h, -px, -py, w, h);
      ctx.restore();
    },
  };
}
```
