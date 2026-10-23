// DEMO_AUTOPILOT Q8: code-drawn presentation candidates, never combat geometry.
pal(FX_PALETTE)
anim("fx_guard_shield", { w: 40, h: 24, frames: 3, fps: 12, loop: true }, (c) => {
  c.ellipse(20, 12, 18, 10, c.frame === 1 ? "w" : "y", true)
  c.arc(20, 12, 16, -60 + c.frame * 20, 60 + c.frame * 20, "j", { inner: 15 })
})
const DIRS = ["e", "se", "s", "sw", "w", "nw", "n", "ne"]
for (let frame = 0; frame < 3; frame++) {
  sprite(`fx_swift_echo_f${frame}`, { w: 64, h: 64 }, (c) => {
    c.arc(32, 32, 28, -50 + frame * 18, 40 + frame * 18, "c", { inner: 27 })
    c.arc(32, 32, 24, -75 + frame * 18, 15 + frame * 18, "C", { inner: 23 })
  })
  DIRS.forEach((d,i) => { if (i > 0) sprite(`fx_swift_echo_f${frame}_${d}`, {base:`fx_swift_echo_f${frame}`, angle:i*45}) })
}
