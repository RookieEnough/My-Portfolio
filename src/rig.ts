// Shared between the page and the 3D keyboard, read every frame.
// p = scroll progress (0 hero, 1 toolkit, 2 gone), intro = start of the key drop (performance.now() seconds).
// The keyboard only renders while something moves; wake() asks it for frames after p or intro change.
// on = the fixed board is on screen. It is a store of its own so flipping it re-renders the board, not the page.
const subs = new Set<() => void>()
export const rig = {
  p: 0,
  intro: -1,
  wake: () => {},
  on: true,
  show(v: boolean) {
    if (v === rig.on) return
    rig.on = v
    subs.forEach((f) => f())
  },
  subscribe(f: () => void) {
    subs.add(f)
    return () => void subs.delete(f)
  },
}
