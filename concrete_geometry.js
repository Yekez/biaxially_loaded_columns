// concrete_geometry.js - compression block clipping, area, and centroid
(function () {
  // PSEUDOCODE FOR CONCRETE AREA / SHAPE
  // 1) Start with the full section polygon.                      (input to clipPolygonWithHalfPlane)
  // 2) Define the stress block boundary line for the current 
  //    (ky, theta) state. This single clipping line is 
  //    parallel to the neutral axis in this model.               (input to clipPolygonWithHalfPlane)
  // 3) Clip the section polygon by that line.                    (clipPolygonWithHalfPlane)
  // 4) The remaining polygon is the concrete compression shape.  
  //    Its full boundary is made from section edges plus the 
  //    clipping segment, so it is not generally parallel to 
  //    the neutral axis as a whole.
  // 5) Re-order the polygon points counterclockwise if needed.   (orientCounterClockwise)
  // 6) Use the shoelace sum to get the polygon area.             (shoelaceDoubleArea)
  // 7) Use the same edge-by-edge cross products to get the 
  //    centroid.                                                 (polygonAreaAndCentroid)
  // 8) Return area + centroid of the clipped concrete polygon.   (polygonAreaAndCentroid)

  // Shoelace formula. This gives 2 x signed area of the polygon.
  function shoelaceDoubleArea(poly) {
    let sum = 0;
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % n];
      sum += p.x * q.y - q.x * p.y;
    }

    return sum;
  }

  // Reverse the points if needed so area stays positive.
  function orientCounterClockwise(poly) {
    const a2 = shoelaceDoubleArea(poly);
    if (Math.abs(a2) < 1e-12) return poly;
    if (a2 < 0) return poly.slice().reverse();
    return poly;
  }

  // Get area and centroid of the compression polygon in one pass.
  function polygonAreaAndCentroid(poly) {
    const p = orientCounterClockwise(poly);
    const A2 = shoelaceDoubleArea(p);

    if (Math.abs(A2) < 1e-12) {
      return null;
    }

    const area = Math.abs(A2) * 0.5;
    let cx = 0;
    let cy = 0;
    const n = p.length;

    for (let i = 0; i < n; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      // Same cross product term used in the shoelace formula.
      const cross = a.x * b.y - b.x * a.y;
      cx += (a.x + b.x) * cross;
      cy += (a.y + b.y) * cross;
    }

    return {
      area: area,
      centroid: {
        x: cx / (3 * A2),
        y: cy / (3 * A2)
      }
    };
  }

  // Keep only the part of the polygon on the allowed side of the line.
  // The compression polygon boundary as a whole is generally not parallel to the neutral axis.
  // Because it is the intersection of the section boundary with the stress block half-plane.
  // So they can be parallel in some cases, but not generally.
  function clipPolygonWithHalfPlane(poly, n, offset, eps) {
    // Small tolerance so points very close to the line are still treated as inside.
    eps = eps || 1e-9;
    // Nothing to clip if the input polygon is empty.
    if (!poly || poly.length === 0) return [];

    const result = [];

    // Line value at point p. Inside means this is <= 0.
    function value(p) {
      return n.x * p.x + n.y * p.y - offset;
    }

    function inside(p) {
      return value(p) <= eps;
    }

    // Intersection point of one polygon edge with the clipping line.
    function intersect(p1, p2) {
      const v1 = value(p1);
      const v2 = value(p2);
      const denom = v1 - v2;

      if (Math.abs(denom) < 1e-12) {
        return { x: p1.x, y: p1.y };
      }

      const t = v1 / (v1 - v2);

      return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
      };
    }

    // Walk edge by edge and keep only the visible part.
    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const next = poly[(i + 1) % poly.length];

      const currInside = inside(curr);
      const nextInside = inside(next);

      if (currInside && nextInside) {
        result.push(next);
      } else if (currInside && !nextInside) {
        result.push(intersect(curr, next));
      } else if (!currInside && nextInside) {
        result.push(intersect(curr, next));
        result.push(next);
      }
    }

    return result;
  }

  window.Geometry = {
    polygonAreaAndCentroid: polygonAreaAndCentroid,
    clipPolygonWithHalfPlane: clipPolygonWithHalfPlane
  };
})();
