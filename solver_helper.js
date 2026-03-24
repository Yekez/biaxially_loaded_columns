// solver_helper.js - small math utilities for the section solver
(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Section plane: origin at bottom-left corner, x right, y up (centroid at b/2, h/2).
  function toCenterCoords(X, Y, b, h) {
    return {
      x: X - b / 2,
      y: Y - h / 2
    };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y;
  }

  function maxProjection(poly, n) {
    let maxVal = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const v = dot(poly[i], n);
      if (v > maxVal) maxVal = v;
    }
    return maxVal;
  }

  window.SolverHelper = {
    clamp: clamp,
    toCenterCoords: toCenterCoords,
    dot: dot,
    maxProjection: maxProjection
  };
})();
