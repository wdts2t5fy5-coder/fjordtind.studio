(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const hero = document.querySelector(".fjord-hero");
  const scene = document.querySelector(".mountain-scene");
  const goatScene = document.querySelector(".goat-scene");
  if (!hero || !scene || !goatScene) return;

  const NS = "http://www.w3.org/2000/svg";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Logo-like mountain skeleton: left cluster, dominant center peak, right cluster.
  const basePoints = {
    l0: [110, 770, -90],
    l1: [230, 660, -30],
    l2: [330, 575, 30],
    l3: [445, 510, 80],
    l4: [560, 430, 130],
    lc: [455, 610, 40],
    ls: [610, 560, 70],

    c1: [675, 370, 165],
    c2: [760, 305, 215],
    c3: [815, 260, 265],
    c4: [875, 315, 225],
    c5: [945, 385, 170],
    cm: [810, 690, 120],
    cl: [640, 635, 110],
    cr: [980, 640, 105],
    ci1: [745, 510, 130],
    ci2: [845, 520, 125],

    r4: [1040, 430, 130],
    r3: [1165, 505, 85],
    r2: [1285, 585, 30],
    r1: [1395, 675, -35],
    r0: [1510, 770, -95],
    rc: [1160, 615, 45],
    rs: [995, 565, 70],
  };

  const facets = [
    { cls: "facet-e", p: ["l0", "l1", "l2"] },
    { cls: "facet-c", p: ["l1", "l2", "lc"] },
    { cls: "facet-b", p: ["l2", "l3", "lc"] },
    { cls: "facet-a", p: ["l3", "l4", "ls"] },
    { cls: "facet-c", p: ["l3", "ls", "lc"] },

    { cls: "facet-a", p: ["l4", "c1", "cl"] },
    { cls: "facet-a", p: ["c1", "c2", "ci1"] },
    { cls: "facet-a", p: ["c2", "c3", "c4"] },
    { cls: "facet-b", p: ["c2", "c4", "ci1"] },
    { cls: "facet-b", p: ["c4", "c5", "ci2"] },
    { cls: "facet-c", p: ["ci1", "ci2", "cm"] },
    { cls: "facet-d", p: ["cl", "ci1", "cm"] },
    { cls: "facet-d", p: ["cm", "ci2", "cr"] },

    { cls: "facet-b", p: ["c5", "r4", "rs"] },
    { cls: "facet-a", p: ["r4", "r3", "rc"] },
    { cls: "facet-b", p: ["r3", "r2", "rc"] },
    { cls: "facet-c", p: ["r2", "r1", "rc"] },
    { cls: "facet-e", p: ["r1", "r0", "r2"] },
    { cls: "facet-c", p: ["r4", "rs", "cr"] },
    { cls: "facet-d", p: ["cr", "rs", "cm"] },
  ];

  const cuts = [
    ["l2", "lc", "l3"],
    ["c1", "ci1", "cl"],
    ["ci1", "c4", "ci2"],
    ["c4", "c5", "ci2"],
    ["ci1", "cm", "ci2"],
    ["rs", "cr", "r3"],
    ["r2", "rc", "r3"],
  ];

  const facetNodes = facets.map((f) => {
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("class", `mountain-facet ${f.cls}`);
    scene.appendChild(poly);
    return poly;
  });

  const cutNodes = cuts.map(() => {
    const poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("class", "mountain-cut");
    scene.appendChild(poly);
    return poly;
  });

  const goatParts = (() => {
    const body = document.createElementNS(NS, "path");
    body.setAttribute("class", "goat-body");
    body.setAttribute("d", "M4 22 L10 13 L24 11 L35 13 L43 9 L52 12 L58 18 L56 24 L47 27 L37 26 L28 29 L14 28 L9 33 L4 32 L7 25 Z");

    const head = document.createElementNS(NS, "path");
    head.setAttribute("class", "goat-head");
    head.setAttribute("d", "M49 13 L60 13 L67 17 L66 22 L59 24 L51 20 Z");

    const legBack = document.createElementNS(NS, "path");
    legBack.setAttribute("class", "goat-leg");
    legBack.setAttribute("d", "M14 28 L19 28 L18 45 L13 45 Z");

    const legFront = document.createElementNS(NS, "path");
    legFront.setAttribute("class", "goat-leg");
    legFront.setAttribute("d", "M32 27 L37 27 L36 46 L31 46 Z");

    const hornA = document.createElementNS(NS, "path");
    hornA.setAttribute("class", "goat-horn");
    hornA.setAttribute("d", "M58 12 C62 4 69 3 73 8 L70 10 C67 7 63 8 60 14 Z");

    const hornB = document.createElementNS(NS, "path");
    hornB.setAttribute("class", "goat-horn");
    hornB.setAttribute("d", "M54 12 C57 5 63 4 67 9 L64 10 C61 8 58 9 56 14 Z");

    goatScene.appendChild(body);
    goatScene.appendChild(head);
    goatScene.appendChild(legBack);
    goatScene.appendChild(legFront);
    goatScene.appendChild(hornA);
    goatScene.appendChild(hornB);
    return { body, head, legBack, legFront, hornA, hornB };
  })();

  const state = {
    t: 0,
    lastTs: performance.now(),
    scrollBoost: 0,
    currentBoost: 0,
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const hash = (name) => {
    let h = 0;
    for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 997;
    return h / 997;
  };

  const project = (name, yaw, pitch, roll, boost) => {
    const base = basePoints[name];
    const [x0, y0, z0] = base;
    const n = hash(name);
    const live = 1 + boost * 1.6;
    const xw = x0 + Math.sin(state.t * (0.26 + n * 0.14) + n * 9) * 3.5 * live;
    const yw = y0 + Math.cos(state.t * (0.21 + n * 0.17) + n * 7) * 2.7 * live;
    const zw = z0 + Math.sin(state.t * (0.18 + n * 0.09) + n * 5) * 4.1 * live;

    const cx = 810;
    const cy = 560;
    const x = xw - cx;
    const y = yw - cy;
    const z = zw;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    const cosX = Math.cos(pitch);
    const sinX = Math.sin(pitch);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const xr = x1 * cosR - y1 * sinR;
    const yr = x1 * sinR + y1 * cosR;

    const p = 1320 / (1320 + z2 + 780);
    return [cx + xr * p, cy + yr * p, z2];
  };

  const polygonPoints = (names, projected) => names.map((n) => `${projected[n][0].toFixed(1)},${projected[n][1].toFixed(1)}`).join(" ");

  const updateBoost = () => {
    const vh = window.innerHeight || 1;
    const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, vh + 1);
    const page = clamp((window.scrollY || 0) / Math.max(1, docH - vh), 0, 1);
    const rect = hero.getBoundingClientRect();
    const heroP = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
    state.scrollBoost = Math.max(page, heroP);
  };

  const draw = () => {
    const b = state.currentBoost;
    const yaw = -0.06 + b * 0.22 + Math.sin(state.t * 0.1) * 0.03;
    const pitch = 0.08 + b * 0.12 + Math.cos(state.t * 0.12) * 0.015;
    const roll = -0.015 + Math.sin(state.t * 0.09) * 0.01;

    const projected = {};
    Object.keys(basePoints).forEach((name) => {
      projected[name] = project(name, yaw, pitch, roll, b);
    });

    const ordered = facets
      .map((f, idx) => {
        const z = (projected[f.p[0]][2] + projected[f.p[1]][2] + projected[f.p[2]][2]) / 3;
        return { idx, z };
      })
      .sort((a, b2) => a.z - b2.z);

    for (let i = 0; i < ordered.length; i += 1) {
      const idx = ordered[i].idx;
      scene.appendChild(facetNodes[idx]);
      facetNodes[idx].setAttribute("points", polygonPoints(facets[idx].p, projected));
    }

    for (let i = 0; i < cuts.length; i += 1) {
      cutNodes[i].setAttribute("points", polygonPoints(cuts[i], projected));
    }

    const summit = projected.c3;
    const goatScale = 0.93 + b * 0.12;
    const goatX = summit[0] - 30;
    const goatY = summit[1] - 66;
    const goatRot = -4 + b * 10 + Math.sin(state.t * 0.34) * 1.2;
    goatScene.setAttribute(
      "transform",
      `translate(${goatX.toFixed(1)} ${goatY.toFixed(1)}) scale(${goatScale.toFixed(3)}) rotate(${goatRot.toFixed(
        2
      )} 32 24)`
    );

    const worldX = -(window.scrollY || 0) * (0.035 + b * 0.06) + Math.sin(state.t * 0.16) * (4 + b * 8);
    const worldY = Math.cos(state.t * 0.2) * (2 + b * 5);
    scene.setAttribute("transform", `translate(${worldX.toFixed(2)} ${worldY.toFixed(2)})`);
  };

  const tick = (ts) => {
    const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    state.currentBoost = lerp(state.currentBoost, state.scrollBoost, 0.06);
    if (!reduceMotion) state.t += dt * (0.1 + state.currentBoost * 0.2);
    draw();
    window.requestAnimationFrame(tick);
  };

  updateBoost();
  draw();
  window.addEventListener("scroll", updateBoost, { passive: true });
  window.addEventListener("resize", updateBoost);
  window.requestAnimationFrame(tick);
})();
