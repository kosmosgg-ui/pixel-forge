// 「성검의 맹세」 전투 이펙트 (P10 2절, pxl 2e72b9a — 코드 그림, 생성형 AI 아님).
// 시작점: 기획 세션 시험작(docs/integrated/G2/samples/pxl_trial/sg_fx.px.js). 아군 효과: 흰·청록·금 — 적 예고색(빨강·주황) 쓰지 않음.
// forge fx-import가 검증된 바이블 fxPalette를 주입한다(승인 기록: P10_G2_CODEX_APPROVALS.md).
pal(FX_PALETTE)

// 8방향 = 오른쪽(0°)부터 시계 방향 45°씩(e se s sw w nw n ne). 프레임마다 스프라이트로 그리고 각도별로 미리 돌린다
// (pxl은 anim에 angle을 주면 첫 프레임만 남아서 — 포장은 forge fx-import가 행 = 방향, 열 = 프레임으로 묶는다).
const DIRS = ["e", "se", "s", "sw", "w", "nw", "n", "ne"]
function eightWay(name, frames) {
  for (let k = 0; k < frames; k++) DIRS.forEach((d, i) => {
    if (i > 0) sprite(`${name}_f${k}_${d}`, { base: `${name}_f${k}`, angle: i * 45 })
  })
}

// 검기 호(오른쪽을 향함): 판정 range 90 → 화면 ×2/3 → 1배 ÷2 ≈ 반지름 30px.
// 스미어 규칙(scenes 12): 0 = 가득·밝게, 1 = 가늘고 어둡게(다른 색), 2 = 끝 조각. 안쪽은 비워 적을 가리지 않는다.
function slash(name, R, sweep, edge, mid, reverse, direct = false) {
  if (direct) return directSlash(name, R, sweep, edge, mid)
  // 호 중심 = 캔버스 가운데(= 게임에서 주인공 위치) — 8방향 회전이 같은 점을 축으로 돈다
  const S = 2 * R + 8, cx = Math.floor(S / 2), cy = Math.floor(S / 2)
  const a0 = -sweep / 2, a1 = sweep / 2
  const from = reverse ? a1 : a0, to = reverse ? a0 : a1
  const lo = Math.min(from, to), hi = Math.max(from, to)
  sprite(`${name}_f0`, { w: S, h: S }, (c) => {
    c.arc(cx, cy, R, lo, hi, mid, { inner: R - 6, taper: true })
    c.arc(cx, cy, R, lo, hi, "w", { inner: R - 2, taper: true })
  })
  sprite(`${name}_f1`, { w: S, h: S }, (c) => {
    const cut = reverse ? [lo, hi - sweep * 0.25] : [lo + sweep * 0.25, hi]
    c.arc(cx, cy, R + 1, cut[0], cut[1], edge, { inner: R - 3, taper: true })
  })
  sprite(`${name}_f2`, { w: S, h: S }, (c) => {
    const tip = reverse ? [lo, lo + 22] : [hi - 22, hi]
    c.arc(cx, cy, R + 1, tip[0], tip[1], edge, { inner: R - 1, taper: true })
  })
  eightWay(name, 3)
}
slash("fx_slash_1", 30, 90, "C", "c", false)
slash("fx_slash_2", 30, 90, "C", "c", true)
slash("fx_slash_3", 31, 110, "j", "y", false)

// Directly rasterize approved directions around one integer anchor. Rotation/recentering of
// the legacy tapered arc shifts its center and narrows its ends beyond the P11 contract.
function directSlash(name, R, sweep, edge, mid) {
  const S = 2 * R + 8, cx = S / 2, outer = R + 1
  DIRS.forEach((d, direction) => {
    for (let frame = 0; frame < 3; frame++) {
      const id = `${name}_f${frame}` + (direction === 0 ? "" : `_${d}`)
      sprite(id, { w: S, h: S }, (c) => {
        const hi = sweep / 2, lo = frame === 0 ? -hi : frame === 1 ? -hi + sweep * .25 : hi - 22
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const dx = x - cx, dy = y - cx, distance = Math.hypot(dx, dy)
          const angle = ((Math.atan2(dy, dx) * 180 / Math.PI - direction * 45 + 540) % 360) - 180
          if (angle < lo || angle > hi || distance > outer) continue
          const taper = 1 + (frame === 0 ? 5 : frame === 1 ? 3 : 1) * (angle - lo) / (hi - lo)
          if (distance < outer - taper) continue
          c.px(x, y, frame === 0 ? (distance >= outer - 1 ? "w" : mid) : edge)
        }
      })
    }
  })
}

// P11: verified JSON pairs injected by the CLI; no game numbers are changed.
for (const spec of FX_SLASH_SPECS) {
  const name = `fx_slash_r${spec.reach}_a${spec.angle}`
  slash(name, Math.floor(spec.reach / 3) - 2, spec.angle, "C", "c", false, true)
}

// 타격 섬광(방향 없음): 어두운 타원 → 흰 4갈래 별 → 흰 원 → 청록·노랑 초승달
anim("fx_hit_spark", { w: 16, h: 16, frames: 4, fps: 20, loop: false }, (c) => {
  const x = 8, y = 8
  if (c.frame === 0) { c.ellipse(x, y, 3, 2, "k"); c.px(x, y, "w") }
  if (c.frame === 1) { c.line(x, y - 6, x, y + 6, "w"); c.line(x - 6, y, x + 6, y, "w"); c.circ(x, y, 2, "w") }
  if (c.frame === 2) { c.circ(x, y, 4, "w"); c.ring(x, y, 5, "c") }
  if (c.frame === 3) { c.arc(x, y, 6, 200, 320, "c", { inner: 4 }); c.arc(x, y, 6, 20, 140, "y", { inner: 4 }) }
})

// 발밑 먼지(회피 시작·급정지): 퍼지며 엷어짐
anim("fx_dust", { w: 16, h: 8, frames: 3, fps: 12, loop: false }, (c) => {
  if (c.frame === 0) { c.ellipse(8, 5, 4, 2, "g"); c.ellipse(7, 4, 2, 1, "v") }
  if (c.frame === 1) { c.ellipse(4, 4, 3, 2, "g"); c.ellipse(12, 4, 3, 2, "g"); c.px(8, 2, "G") }
  if (c.frame === 2) { c.px(1, 3, "G"); c.px(3, 2, "g"); c.px(12, 2, "g"); c.px(14, 3, "G") }
})

// 적 사망 연기·파편(중립색 — 적 색과 무관): 가장 큰 뒤 4갈래로 나뉘어 비고 흩어짐
anim("fx_death_puff", { w: 24, h: 24, frames: 4, fps: 12, loop: false }, (c) => {
  const x = 12, y = 13
  if (c.frame === 0) { c.circ(x, y, 7, "g"); c.circ(x - 1, y - 2, 4, "v") }
  if (c.frame === 1) { c.circ(x - 4, y - 2, 4, "g"); c.circ(x + 4, y - 1, 4, "g"); c.circ(x, y + 3, 3, "G"); c.circ(x, y - 6, 3, "g") }
  if (c.frame === 2) { c.ring(x - 5, y - 4, 3, "G"); c.ring(x + 5, y - 3, 3, "G"); c.px(x, y + 5, "g"); c.px(x - 1, y - 9, "g") }
  if (c.frame === 3) { c.px(x - 7, y - 7, "G"); c.px(x + 7, y - 6, "G"); c.px(x + 2, y - 10, "g") }
})

// 경험치 보석(크기 3단계 = 색 3단계 — 행 small·medium·large): 쉬다가 4프레임 반짝임 훑기
function gem(name, dark, light) {
  anim(name, { w: 8, h: 8, frames: 8, fps: 10, outline: "k" }, (c) => {
    c.poly([3, 0, 6, 3, 3, 7, 0, 3], dark)
    c.poly([3, 1, 5, 3, 3, 5, 1, 3], light)
    c.px(2, 2, "w")
    const s = c.frame - 4
    if (s === 0) c.px(1, 3, "w")
    if (s === 1) c.line(2, 4, 3, 3, "w")
    if (s === 2) c.line(3, 5, 5, 3, "w")
    if (s === 3) c.px(4, 4, "w")
  })
}
gem("fx_xp_gem_small", "M", "m")
gem("fx_xp_gem_medium", "C", "c")
gem("fx_xp_gem_large", "j", "y")

// 발밑 고리(주인공·회피 재사용 대기 표시): 0~8단계 채움
for (let i = 0; i <= 8; i++) {
  sprite(`fx_ring_${i}`, { w: 24, h: 9 }, (c) => {
    c.ellipse(12, 4, 11, 4, "J", true)
    if (i > 0) c.arc(12, 4, 11, -90, -90 + i * 45, "y")
  })
}

// 필살기 충격파: 흰 고리가 퍼지며 금색으로, 얇아짐
anim("fx_shockwave", { w: 96, h: 48, frames: 5, fps: 14, loop: false }, (c) => {
  const k = c.frame, rx = 10 + k * 9, ry = 5 + k * 4.5
  c.ellipse(48, 24, rx, ry, k < 2 ? "w" : "y", true)
  if (k < 3) c.ellipse(48, 24, rx - 1, ry - 1, k < 1 ? "w" : "j", true)
})

// 추적 검편 투사체: 밝은 심·차가운 가장자리, 꼬리 길이 교대(2프레임)
for (let k = 0; k < 2; k++) {
  sprite(`fx_proj_seeker_f${k}`, { w: 16, h: 8 }, (c) => {
    c.poly([15, 4, 10, 2, 8, 4, 10, 6], "c")
    c.line(10, 4, 14, 4, "w")
    c.line(k ? 4 : 1, 4, 8, 4, "C")
    if (!k) c.px(0, 4, "n")
  })
}
eightWay("fx_proj_seeker", 2)

// 회전검: 오른쪽을 향한 검 1장 → 각도별 그림(회전 대신 미리 생성)
sprite("fx_orbit_sword_f0", { w: 16, h: 16 }, (c) => {
  c.line(6, 8, 14, 8, "w"); c.line(6, 7, 13, 7, "c"); c.px(15, 8, "w")
  c.line(5, 5, 5, 11, "j")
  c.line(1, 8, 4, 8, "J")
})
eightWay("fx_orbit_sword", 1)

// 관통 검기 빛줄: 흰 심 + 청록 테두리, 굵기 깜빡임
for (let k = 0; k < 3; k++) {
  sprite(`fx_beam_f${k}`, { w: 64, h: 12 }, (c) => {
    const half = [4, 3, 2][k]
    c.rect(2, 6 - half, 60, half * 2, "C")
    c.rect(4, 6 - Math.max(1, half - 2), 56, Math.max(1, half - 2) * 2, "w")
    c.px(63, 6, "c")
  })
}
eightWay("fx_beam", 3)
