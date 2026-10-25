# Landing page: no WebGL on phones

Opened: 2026-10-25 16:39 PHT

**What**
- The three.js phones run only with a mouse on a screen 1024px or wider (`hover: hover`, `pointer: fine`). Elsewhere the apps section shows flat iPhone frames (`IPhone flat`), switched in CSS (`.phones-3d` / `.phones-fallback`), so WebGL never starts on a phone.

**Why**
After #268 the page still crashed on an iPhone ("can't open this page", Safari's message for a tab that keeps crashing). The WebGL scene and its environment map were the heaviest thing left there.

**Tested**
`tsc` and `eslint` pass. 390px shows the flat phones; 1440px still has the 3D scene. **Not yet confirmed on the iPhone that crashed.**

**Not done / next**
- If it still crashes, the next suspect is the hero video loop on phones (a poster image instead).
