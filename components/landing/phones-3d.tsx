"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export type PhoneSpec = { src: string; alt: string };

/*
 * Three iPhone 16 Pros in three.js, for the apps section. Built in millimetres
 * from the real phone: 71.5 × 149.6 × 8.25 mm, squircle corners, a titanium band
 * with rounded edges, the black glass and bezel, the Dynamic Island, and the
 * buttons on the sides (Action and volume left; side button and Camera Control
 * right). Lit with a studio environment so the titanium reads as metal.
 *
 * They turn into place as the section scrolls in, float a little, and lean
 * toward the pointer. Reduced motion: drawn once, at rest. No WebGL: `fallback`.
 * Rendering stops while the section is off screen.
 */
export function Phones3D({ phones, fallback }: { phones: [PhoneSpec, PhoneSpec, PhoneSpec]; fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (cancelled) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        setFailed(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      el.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(-200, 300, 400);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(24, 1, 10, 3000);

      // --- geometry, in mm ---
      const W = 71.5, H = 149.6, D = 8.25;
      /** A rounded rectangle with squircle (superellipse) corners, like Apple's continuous corners. */
      const squircle = (w: number, h: number, r: number, n = 3.2) => {
        const s = new THREE.Shape();
        const pts: [number, number][] = [];
        const corners: [number, number, number][] = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
        for (const [cx, cy, q] of corners) {
          for (let i = 0; i <= 16; i++) {
            const a = (q + i / 16) * (Math.PI / 2);
            const c = Math.cos(a), si = Math.sin(a);
            pts.push([cx + r * Math.sign(c) * Math.abs(c) ** (2 / n), cy + r * Math.sign(si) * Math.abs(si) ** (2 / n)]);
          }
        }
        s.moveTo(...pts[0]);
        for (const p of pts.slice(1)) s.lineTo(...p);
        s.closePath();
        return s;
      };
      /** Flat shape geometry with UVs that span its bounding box (so a picture fills it). */
      const flat = (shape: import("three").Shape) => {
        const g = new THREE.ShapeGeometry(shape, 24);
        g.computeBoundingBox();
        const b = g.boundingBox!, pos = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
        return g;
      };

      const bevel = 1.1;
      const bodyGeo = new THREE.ExtrudeGeometry(squircle(W - 2 * bevel, H - 2 * bevel, 17 - bevel), {
        depth: D - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 8, curveSegments: 48,
      });
      bodyGeo.translate(0, 0, -(D - 2 * bevel) / 2);
      const glassGeo = flat(squircle(W - 0.7, H - 0.7, 16.6));
      const screenGeo = flat(squircle(W - 4.4, H - 4.4, 14.6));
      const islandGeo = flat(squircle(20.5, 6.1, 3.05, 2));
      const backGeo = flat(squircle(W - 1.2, H - 1.2, 16.3));
      const button = (len: number, wide: number) => {
        const g = new THREE.ExtrudeGeometry(squircle(wide, len, wide / 2 - 0.05, 2), { depth: 0.7, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 3 });
        return g;
      };

      const titanium = new THREE.MeshPhysicalMaterial({ color: 0xc8c3cb, metalness: 1, roughness: 0.3 });
      const glass = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 });
      const back = new THREE.MeshPhysicalMaterial({ color: 0xd3cfd6, metalness: 0.1, roughness: 0.55 });
      const sapphire = new THREE.MeshPhysicalMaterial({ color: 0x2c2a30, metalness: 0.3, roughness: 0.15, clearcoat: 1 });
      const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

      const loader = new THREE.TextureLoader();
      const make = (src: string) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(bodyGeo, titanium));
        const front = new THREE.Mesh(glassGeo, glass); front.position.z = D / 2 + 0.02; g.add(front);
        const tex = loader.load(src, () => draw());
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        // the screenshots are taller than the screen: show the top, like the real phone
        tex.repeat.set(1, 0.985); tex.offset.set(0, 0.015);
        const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        screen.position.z = D / 2 + 0.04; g.add(screen);
        const island = new THREE.Mesh(islandGeo, black); island.position.set(0, (H - 4.4) / 2 - 3.6 - 3.05, D / 2 + 0.06); g.add(island);
        const backGlass = new THREE.Mesh(backGeo, back); backGlass.position.z = -D / 2 - 0.02; backGlass.rotation.y = Math.PI; g.add(backGlass);
        // buttons: [side, from the top (mm), length (mm), Camera Control?]
        for (const [side, top, len, cc] of [[-1, 26.2, 6.9, 0], [-1, 37.4, 12, 0], [-1, 52.4, 12, 0], [1, 38.9, 18.7, 0], [1, 88.3, 10.5, 1]] as const) {
          const m = new THREE.Mesh(button(len, cc ? 4.2 : 3.2), cc ? sapphire : titanium);
          m.rotation.y = side * (Math.PI / 2);
          m.position.set(side * (W / 2 - 0.35), H / 2 - top - len / 2, 0);
          g.add(m);
        }
        return g;
      };

      const rest = [
        { x: -82, y: -4, z: -24, ry: 0.42 },
        { x: 0, y: 6, z: 10, ry: 0 },
        { x: 82, y: -4, z: -24, ry: -0.42 },
      ];
      const groups = phones.map((p, i) => { const g = make(p.src); scene.add(g); g.position.set(rest[i].x, rest[i].y, rest[i].z); g.rotation.y = rest[i].ry; return g; });

      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      let px = 0, py = 0, tx = 0, ty = 0;
      const onPointer = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      const size = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        // fit the three phones' width (~250 mm) and height (~170 mm)
        const fitH = 168 / (2 * Math.tan((camera.fov * Math.PI) / 360));
        const fitW = 240 / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
        camera.position.set(0, 0, Math.max(fitH, fitW));
        camera.updateProjectionMatrix();
        draw();
      };

      let visible = false, raf = 0;
      const t0 = performance.now();
      function draw() {
        const t = (performance.now() - t0) / 1000;
        const r = el!.getBoundingClientRect();
        // 0 as the section enters from below, 1 once its middle reaches the middle of the screen
        const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.75)));
        const k = reduce ? 1 : 1 - (1 - p) ** 3;
        px += (tx - px) * 0.06; py += (ty - py) * 0.06;
        groups.forEach((g, i) => {
          const s = rest[i];
          const float = reduce ? 0 : Math.sin(t * 1.1 + i * 1.7) * 2.2;
          g.position.set(s.x, s.y + float - (1 - k) * 40, s.z);
          g.rotation.y = s.ry + (1 - k) * (i === 1 ? 0.9 : i === 0 ? 1.1 : -1.1) + (reduce ? 0 : px * 0.18);
          g.rotation.x = (reduce ? 0 : py * 0.1) + (1 - k) * 0.25;
          g.rotation.z = reduce ? 0 : Math.sin(t * 0.7 + i) * 0.012;
        });
        renderer.render(scene, camera);
      }
      const loop = () => { draw(); if (visible && !reduce) raf = requestAnimationFrame(loop); };

      const ro = new ResizeObserver(size); ro.observe(el); size();
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) loop();
      });
      io.observe(el);
      const onScroll = () => { if (reduce && visible) draw(); };
      window.addEventListener("scroll", onScroll, { passive: true });

      cleanup = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        window.removeEventListener("pointermove", onPointer); window.removeEventListener("scroll", onScroll);
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as import("three").MeshBasicMaterial | undefined;
          if (mat) { mat.map?.dispose(); mat.dispose(); }
        });
        pmrem.dispose(); renderer.dispose(); renderer.domElement.remove();
      };
    })().catch(() => setFailed(true));

    return () => { cancelled = true; cleanup(); };
  }, [phones]);

  if (failed) return <>{fallback}</>;
  return (
    <div className="relative">
      <div ref={box} className="aspect-[6/5] w-full" />
      <ul className="sr-only">
        {phones.map((p) => <li key={p.src}>{p.alt}</li>)}
      </ul>
    </div>
  );
}
