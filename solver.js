// solver.js - section model, solveSectionState, interaction sweep, Bresler entry point
(function () {
  const Geometry = window.Geometry;
  const H = window.SolverHelper;

  const section = {
    b: 300,
    h: 300,
    coverToBarCenter: 45,
    phi: 20,

    fck: 20,
    alpha: 0.85,
    fyd: 420,
    Es: 200000,
    epsCu: 0.003,
    k1: 0.85
  };

  section.As = Math.PI * section.phi * section.phi / 4;
  section.fcd = section.alpha * section.fck;

  // Section plane: origin bottom-left, x to the right, y upward (CCW boundary).
  const sectionPolygon = [
    { x: 0, y: 0 },
    { x: section.b, y: 0 },
    { x: section.b, y: section.h },
    { x: 0, y: section.h }
  ];

  const barsCenter = [
    { name: "topLeft",     x: -105, y:  105 },
    { name: "topRight",    x:  105, y:  105 },
    { name: "bottomLeft",  x: -105, y: -105 },
    { name: "bottomRight", x:  105, y: -105 }
  ];

  // X, Y: same section plane as sectionPolygon (BL origin, y up). Kept as barsTopLeft on RCSolver for API stability.
  const barsTopLeft = barsCenter.map(function (bar) {
    return {
      name: bar.name,
      x: bar.x,
      y: bar.y,
      X: bar.x + section.b / 2,
      Y: bar.y + section.h / 2
    };
  });

  /*
    Main solve for one (ky, theta) state.
    1) Build the equivalent concrete stress block from c and a = k1 * c.
    2) Clip the section to get the compression polygon.
    3) Get concrete area and centroid, then concrete force and moments.
    4) Get steel strain from the same linear strain field, then steel force and moments.
    5) Add concrete and steel contributions to get N, Mx, and My.
  */
  function solveSectionState(ky, thetaDeg, overrides) {
    const cfg = Object.assign({}, section, overrides || {});
    const theta = thetaDeg * Math.PI / 180;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    if (Math.abs(cosT) < 1e-12) {
      return null;
    }

    const kyh = ky * cfg.h;
    const c = kyh * cosT;
    const a = cfg.k1 * c;

    if (c <= 0 || a <= 0) {
      return null;
    }

    // Normal n in section coords (x right, y up); matches former y-down frame via n_y -> -n_y_old.
    const n = {
      x: -sinT,
      y: cosT
    };

    const uMax = H.maxProjection(sectionPolygon, n);
    const uBlock = uMax - a;

    const concretePoly = Geometry.clipPolygonWithHalfPlane(
      sectionPolygon,
      { x: -n.x, y: -n.y },
      -uBlock
    );

    if (!concretePoly || concretePoly.length < 3) {
      return null;
    }

    const concreteGeom = Geometry.polygonAreaAndCentroid(concretePoly);
    if (!concreteGeom) {
      return null;
    }

    const Ac = concreteGeom.area;
    const centroidSection = concreteGeom.centroid;
    const centroidC = H.toCenterCoords(
      centroidSection.x,
      centroidSection.y,
      cfg.b,
      cfg.h
    );

    const Nc = cfg.fcd * Ac;
    const Mxc = Nc * centroidC.y;
    const Myc = Nc * centroidC.x;

    let Ns = 0;
    let Mxs = 0;
    let Mys = 0;

    const steelBars = [];

    for (let i = 0; i < barsTopLeft.length; i++) {
      const bar = barsTopLeft[i];
      const uBar = H.dot({ x: bar.X, y: bar.Y }, n);
      const d = uMax - uBar;

      const epsS = cfg.epsCu * (1 - d / c);
      let sigmaS = cfg.Es * epsS;
      sigmaS = H.clamp(sigmaS, -cfg.fyd, cfg.fyd);

      const Fs = sigmaS * cfg.As;

      const MxBar = Fs * bar.y;
      const MyBar = Fs * bar.x;

      Ns += Fs;
      Mxs += MxBar;
      Mys += MyBar;

      steelBars.push({
        name: bar.name,
        x: bar.x,
        y: bar.y,
        X: bar.X,
        Y: bar.Y,
        uBar: uBar,
        d: d,
        epsS: epsS,
        sigmaS: sigmaS,
        Fs: Fs
      });
    }

    const N = Nc + Ns;
    const Mx = Mxc + Mxs;
    const My = Myc + Mys;

    return {
      ky: ky,
      thetaDeg: thetaDeg,
      theta: theta,
      kyh: kyh,
      c: c,
      a: a,
      n: n,
      uMax: uMax,
      uBlock: uBlock,
      concrete: {
        polygon: concretePoly,
        Ac: Ac,
        Nc: Nc,
        centroidSection: centroidSection,
        centroidCenter: centroidC,
        Mxc: Mxc,
        Myc: Myc
      },
      steel: {
        Ns: Ns,
        Mxs: Mxs,
        Mys: Mys,
        bars: steelBars
      },
      N: N,
      Mx: Mx,
      My: My
    };
  }

  // Sweep the chosen ky and theta ranges and solve one state at each grid point.
  // Keep only valid states with N >= 0, then store the results in plotting units.
  // This output becomes the interaction surface used by the 3D plot, slices, and Bresler check.
  function generateInteractionResults(options) {
    const opts = Object.assign({
      kyMin: 0.1,
      kyMax: 4.0,
      kyStep: 0.1,
      thetaMin: 0,
      thetaMax: 89,
      thetaStep: 1
    }, options || {});

    const results = [];

    for (let ky = opts.kyMin; ky <= opts.kyMax + 1e-12; ky += opts.kyStep) {
      for (let thetaDeg = opts.thetaMin; thetaDeg <= opts.thetaMax; thetaDeg += opts.thetaStep) {
        const state = solveSectionState(ky, thetaDeg);
        if (!state) continue;
        if (state.N < 0) continue;
        const N_kN = state.N / 1000;
        const Mx_kNm = state.Mx / 1e6;
        const My_kNm = state.My / 1e6;
        results.push({
          ky: Number(ky.toFixed(2)),
          thetaDeg: thetaDeg,
          N_kN: Number(N_kN.toFixed(2)),
          Mx_kNm: Number(Mx_kNm.toFixed(2)),
          My_kNm: Number(My_kNm.toFixed(2)),
          raw: state
        });
      }
    }

    return results;
  }

  const B = window.Bresler;

  window.RCSolver = {
    section: section,
    barsTopLeft: barsTopLeft,
    solveSectionState: solveSectionState,
    generateInteractionResults: generateInteractionResults,
    breslerReciprocalKN: B.breslerReciprocalKN
  };
})();
