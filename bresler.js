// bresler.js - reciprocal load approximation from interaction surface samples
(function () {
  // kN*m - surface points with the "other" moment below this are treated as uniaxial slices.
  const BRESLER_UNIAXIAL_OTHER_M_KNM = 5;

  // Bresler reciprocal load: 1/Pn ~ 1/Pnx + 1/Pny - 1/P0 (nominal capacities, compression positive).
  // Pnx: axial strength at eccentricity abs(ex) = abs(M_x)/P with M_y ~ 0; Pny analogously; P0 ~ max N on surface.
  function uniaxialCapacityKN(results, axis, eAbs_m, tolOtherKNm) {
    if (!results || !results.length || !(eAbs_m >= 0) || !Number.isFinite(eAbs_m)) {
      return null;
    }

    const keyM = axis === "x" ? "Mx_kNm" : "My_kNm";
    const keyO = axis === "x" ? "My_kNm" : "Mx_kNm";
    const pts = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.N_kN < 1e-6) continue;
      if (Math.abs(r[keyO]) > tolOtherKNm) continue;
      const e = Math.abs(r[keyM]) / r.N_kN;
      if (!Number.isFinite(e)) continue;
      pts.push({ e: e, N: r.N_kN });
    }

    if (pts.length < 2) return null;

    const band = Math.max(0.003, 0.08 * eAbs_m, 1e-4);
    let bestN = -Infinity;
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j];
      if (Math.abs(p.e - eAbs_m) <= band) {
        if (p.N > bestN) bestN = p.N;
      }
    }

    if (bestN > 0) return bestN;

    pts.sort(function (a, b) {
      return a.e - b.e;
    });

    if (eAbs_m <= pts[0].e) return pts[0].N;
    const last = pts[pts.length - 1];
    if (eAbs_m >= last.e) return last.N;

    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      if (eAbs_m >= a.e && eAbs_m <= b.e) {
        const t = (eAbs_m - a.e) / (b.e - a.e);
        return a.N + t * (b.N - a.N);
      }
    }

    return null;
  }

  function maxAxialFromSurfaceKN(results) {
    if (!results || !results.length) return null;
    let m = -Infinity;
    for (let i = 0; i < results.length; i++) {
      const n = results[i].N_kN;
      if (n > m) m = n;
    }
    return Number.isFinite(m) ? m : null;
  }

  function breslerReciprocalKN(results, Pu_kN, Mx_kNm, My_kNm) {
    if (!results || !results.length) {
      return { ok: false, error: "No interaction surface data - generate the surface first." };
    }
    if (!Number.isFinite(Pu_kN) || Pu_kN <= 0) {
      return { ok: false, error: "P must be a positive axial load (kN)." };
    }
    if (!Number.isFinite(Mx_kNm)) Mx_kNm = 0;
    if (!Number.isFinite(My_kNm)) My_kNm = 0;

    const ex = Mx_kNm / Pu_kN;
    const ey = My_kNm / Pu_kN;
    const Po = maxAxialFromSurfaceKN(results);
    const Pnx = uniaxialCapacityKN(
      results,
      "x",
      Math.abs(ex),
      BRESLER_UNIAXIAL_OTHER_M_KNM
    );
    const Pny = uniaxialCapacityKN(
      results,
      "y",
      Math.abs(ey),
      BRESLER_UNIAXIAL_OTHER_M_KNM
    );

    if (Po == null || Po <= 0) {
      return { ok: false, error: "Could not estimate P0 from surface." };
    }
    if (Pnx == null || Pnx <= 0) {
      return {
        ok: false,
        error: "Could not estimate Pnx (try a denser ky and theta grid).",
        Po: Po,
        ex_m: ex,
        ey_m: ey
      };
    }
    if (Pny == null || Pny <= 0) {
      return {
        ok: false,
        error: "Could not estimate Pny (try a denser ky and theta grid).",
        Po: Po,
        Pnx: Pnx,
        ex_m: ex,
        ey_m: ey
      };
    }

    const inv = 1 / Pnx + 1 / Pny - 1 / Po;
    if (!Number.isFinite(inv) || inv <= 0) {
      return {
        ok: false,
        error: "Reciprocal expression non-positive (1/Pnx + 1/Pny - 1/P0 <= 0).",
        Po: Po,
        Pnx: Pnx,
        Pny: Pny,
        ex_m: ex,
        ey_m: ey
      };
    }

    const PnBresler = 1 / inv;
    return {
      ok: true,
      Po: Po,
      Pnx: Pnx,
      Pny: Pny,
      PnBresler: PnBresler,
      Pu: Pu_kN,
      ex_m: ex,
      ey_m: ey,
      demandOk: Pu_kN <= PnBresler
    };
  }

  window.Bresler = {
    breslerReciprocalKN: breslerReciprocalKN
  };
})();
