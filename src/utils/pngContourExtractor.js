import { contours as createContours } from "d3";

/**
 * Extract the largest opaque region from a PNG image.
 *
 * @param {string} imageUrl Image URL or data URL
 * @param {number} scale Scale factor applied to the resulting coordinates
 * @param {number} offsetX X offset applied to the resulting coordinates
 * @param {number} offsetY Y offset applied to the resulting coordinates
 * @param {number} alphaThreshold Alpha threshold in the range 0-255
 * @returns {Promise<Array<[number, number]>>} Polygon coordinates
 */
export async function extractContourFromPNG(
  imageUrl,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  alphaThreshold = 128,
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx || img.width === 0 || img.height === 0) {
          throw new Error("PNG has no drawable image data");
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const { data, width, height } = ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const mask = new Uint8Array(width * height);

        for (let i = 0; i < mask.length; i++) {
          mask[i] = data[i * 4 + 3] >= alphaThreshold ? 1 : 0;
        }

        const contour = createContours()
          .size([width, height])
          .thresholds([0.5])(mask)[0];
        const outerRing = largestOuterRing(contour?.coordinates || []);

        if (!outerRing) {
          resolve([]);
          return;
        }

        // D3 returns closed rings. Remove the duplicate endpoint because SVG and
        // the Voronoi worker close polygons themselves.
        const ring = removeClosingPoint(outerRing).map(([x, y]) => [
          offsetX + x * scale,
          offsetY + y * scale,
        ]);

        resolve(simplifyClosedRing(ring, 2));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageUrl;
  });
}

function largestOuterRing(multiPolygon) {
  let largestRing = null;
  let largestArea = 0;

  for (const polygon of multiPolygon) {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length < 4) continue;

    const area = Math.abs(signedArea(outerRing));
    if (area > largestArea) {
      largestArea = area;
      largestRing = outerRing;
    }
  }

  return largestRing;
}

function signedArea(points) {
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    area += points[i][0] * points[next][1];
    area -= points[next][0] * points[i][1];
  }

  return area / 2;
}

function removeClosingPoint(points) {
  if (points.length < 2) return points;

  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return points.slice(0, -1);
  }

  return points;
}

function simplifyClosedRing(points, tolerance) {
  if (points.length < 4) return points;

  // Split the ring at two distant points, simplify both open chains, then join
  // them again. Running Douglas-Peucker directly on a closed ring gives it the
  // same start and end point and can create an artificial closing chord.
  const firstAnchor = points.reduce(
    (best, point, index) =>
      point[0] < points[best][0] ? index : best,
    0,
  );
  const secondAnchor = points.reduce((best, point, index) => {
    const bestDistance = squaredDistance(points[firstAnchor], points[best]);
    const distance = squaredDistance(points[firstAnchor], point);
    return distance > bestDistance ? index : best;
  }, firstAnchor);

  const firstChain = circularSlice(points, firstAnchor, secondAnchor);
  const secondChain = circularSlice(points, secondAnchor, firstAnchor);
  const firstSimplified = simplifyOpenLine(firstChain, tolerance);
  const secondSimplified = simplifyOpenLine(secondChain, tolerance);
  const simplified = firstSimplified
    .slice(0, -1)
    .concat(secondSimplified.slice(0, -1));

  return simplified.length >= 3 ? simplified : points;
}

function circularSlice(points, start, end) {
  const result = [points[start]];
  let index = start;

  while (index !== end) {
    index = (index + 1) % points.length;
    result.push(points[index]);
  }

  return result;
}

function simplifyOpenLine(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance <= tolerance) return [start, end];

  const before = simplifyOpenLine(points.slice(0, maxIndex + 1), tolerance);
  const after = simplifyOpenLine(points.slice(maxIndex), tolerance);
  return before.slice(0, -1).concat(after);
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];

  if (dx === 0 && dy === 0) {
    return Math.sqrt(squaredDistance(point, lineStart));
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - lineStart[0]) * dx +
        (point[1] - lineStart[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  const closest = [lineStart[0] + t * dx, lineStart[1] + t * dy];
  return Math.sqrt(squaredDistance(point, closest));
}

function squaredDistance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}
