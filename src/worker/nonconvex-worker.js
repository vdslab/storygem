console.log("nonconvex-worker.js loaded");

import * as d3 from "d3";
import polygonClipping from "polygon-clipping";
import { fontSize } from "../fonts";

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonArea(polygon) {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area) / 2;
}

function polygonCentroid(polygon) {
  let cx = 0,
    cy = 0;
  const area = polygonArea(polygon);

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const factor =
      polygon[i][0] * polygon[j][1] - polygon[j][0] * polygon[i][1];
    cx += (polygon[i][0] + polygon[j][0]) * factor;
    cy += (polygon[i][1] + polygon[j][1]) * factor;
  }

  const scale = 1 / (6 * area);
  return [cx * scale, cy * scale];
}


function computeClippedVoronoiCells(generators, weights, boundary) {
  const n = generators.length;
  
  const xMin = Math.min(...boundary.map(p => p[0]));
  const xMax = Math.max(...boundary.map(p => p[0]));
  const yMin = Math.min(...boundary.map(p => p[1]));
  const yMax = Math.max(...boundary.map(p => p[1]));
  
  const delaunay = d3.Delaunay.from(generators);
  const voronoi = delaunay.voronoi([xMin - 100, yMin - 100, xMax + 100, yMax + 100]);
  
  const cells = [];
  
  for (let i = 0; i < n; i++) {
    const voronoiCell = voronoi.cellPolygon(i);
    if (voronoiCell) {
      try {
        const intersection = polygonClipping.intersection(
          [voronoiCell],
          [boundary]
        );
        
        if (intersection.length > 0 && intersection[0].length > 0) {
          cells.push(intersection[0][0]);
        } else {
          cells.push([]);
        }
      } catch (e) {
        console.error("Clipping error for cell", i, e);
        const clippedCell = clipPolygonToPolygon(voronoiCell, boundary);
        cells.push(clippedCell);
      }
    } else {
      cells.push([]);
    }
  }
  
  return cells;
}

function clipPolygonToPolygon(subjectPolygon, clipPolygon) {
  const insidePoints = subjectPolygon.filter(p => pointInPolygon(p, clipPolygon));
  
  const intersections = [];
  
  for (let i = 0; i < subjectPolygon.length; i++) {
    const p1 = subjectPolygon[i];
    const p2 = subjectPolygon[(i + 1) % subjectPolygon.length];
    
    for (let j = 0; j < clipPolygon.length; j++) {
      const c1 = clipPolygon[j];
      const c2 = clipPolygon[(j + 1) % clipPolygon.length];
      
      const intersection = lineIntersection(p1, p2, c1, c2);
      if (intersection && isPointOnSegment(intersection, p1, p2) && isPointOnSegment(intersection, c1, c2)) {
        intersections.push(intersection);
      }
    }
  }
  
  const clipInsidePoints = clipPolygon.filter(p => pointInPolygon(p, subjectPolygon));
  
  const allPoints = [...insidePoints, ...intersections, ...clipInsidePoints];
  
  if (allPoints.length < 3) {
    return [];
  }
  
  const uniquePoints = [];
  for (const p of allPoints) {
    if (!uniquePoints.some(up => Math.abs(up[0] - p[0]) < 1e-10 && Math.abs(up[1] - p[1]) < 1e-10)) {
      uniquePoints.push(p);
    }
  }
  
  if (uniquePoints.length < 3) {
    return [];
  }
  
  const center = polygonCentroid(uniquePoints);
  uniquePoints.sort((a, b) => {
    const angleA = Math.atan2(a[1] - center[1], a[0] - center[0]);
    const angleB = Math.atan2(b[1] - center[1], b[0] - center[0]);
    return angleA - angleB;
  });
  
  return uniquePoints;
}

function isPointOnSegment(p, a, b) {
  const epsilon = 1e-10;
  const crossProduct = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1]);
  
  if (Math.abs(crossProduct) > epsilon) {
    return false;
  }
  
  const dotProduct = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  const squaredLength = (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]);
  
  if (dotProduct < -epsilon || dotProduct > squaredLength + epsilon) {
    return false;
  }
  
  return true;
}

function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];
  const x4 = p4[0], y4 = p4[1];
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  
  return [
    x1 + t * (x2 - x1),
    y1 + t * (y2 - y1)
  ];
}

function adjustWeights(weights, actualAreas, desiredAreas, totalArea) {
  const n = weights.length;
  const adjustmentFactor = 0.5;

  for (let i = 0; i < n; i++) {
    const actualRatio = actualAreas[i] / totalArea;
    const desiredRatio = desiredAreas[i];

    if (desiredRatio > 0 && actualRatio > 0) {
      const error = (desiredRatio - actualRatio) / desiredRatio;
      
      weights[i] *= Math.exp(adjustmentFactor * error);
      
      weights[i] = Math.max(0.1, Math.min(weights[i], 100));
    }
  }

  return weights;
}

function computeVoronoiTreemap(
  boundary,
  desiredAreas,
  maxIterations = 200,
  epsilon = 0.02,
) {
  const n = desiredAreas.length;
  const totalArea = polygonArea(boundary);

  console.log("computeVoronoiTreemap:", {
    n,
    totalArea,
    desiredAreas,
    boundaryPoints: boundary.length,
  });

  const generators = [];
  const [xMin, xMax] = d3.extent(boundary, (p) => p[0]);
  const [yMin, yMax] = d3.extent(boundary, (p) => p[1]);

  let attempts = 0;
  while (generators.length < n && attempts < n * 100) {
    const x = xMin + Math.random() * (xMax - xMin);
    const y = yMin + Math.random() * (yMax - yMin);

    if (pointInPolygon([x, y], boundary)) {
      generators.push([x, y]);
    }
    attempts++;
  }

  while (generators.length < n) {
    const centroid = polygonCentroid(boundary);
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.random() * Math.min(xMax - xMin, yMax - yMin) * 0.1;
    generators.push([
      centroid[0] + radius * Math.cos(angle),
      centroid[1] + radius * Math.sin(angle),
    ]);
  }

  console.log("Initial generators:", generators.length);

  let weights = new Array(n).fill(1);

  let iteration = 0;
  let stable = false;

  while (!stable && iteration < maxIterations) {
    const cells = computeClippedVoronoiCells(generators, weights, boundary);

    const actualAreas = cells.map((cell) =>
      cell && cell.length > 0 ? polygonArea(cell) : 0,
    );

    if (iteration === 0 || iteration % 10 === 0) {
      console.log(`Iteration ${iteration} cells:`, {
        cellsCount: cells.length,
        nonEmptyCells: cells.filter((c) => c.length > 0).length,
        actualAreas: actualAreas.slice(0, 5),
      });
    }

    stable = true;
    let maxError = 0;
    let totalError = 0;
    
    for (let i = 0; i < n; i++) {
      if (actualAreas[i] > 0) {
        const actualRatio = actualAreas[i] / totalArea;
        const desiredRatio = desiredAreas[i];
        const error = Math.abs(actualRatio - desiredRatio);
        
        maxError = Math.max(maxError, error);
        totalError += error;

        if (error >= epsilon * desiredRatio) {
          stable = false;
        }
      }
    }
    
    if (iteration % 10 === 0) {
      console.log(`Iteration ${iteration} - Max error: ${maxError.toFixed(4)}, Total error: ${totalError.toFixed(4)}`);
    }

    if (!stable) {
      weights = adjustWeights(weights, actualAreas, desiredAreas, totalArea);

      generators.forEach((gen, i) => {
        if (cells[i] && cells[i].length > 0) {
          const centroid = polygonCentroid(cells[i]);
          if (pointInPolygon(centroid, boundary)) {
            const alpha = 0.7;
            generators[i] = [
              gen[0] + alpha * (centroid[0] - gen[0]),
              gen[1] + alpha * (centroid[1] - gen[1])
            ];
          }
        }
      });
    }

    iteration++;
  }

  const finalCells = computeClippedVoronoiCells(generators, weights, boundary);

  return {
    cells: finalCells,
    generators: generators,
    weights: weights,
    iterations: iteration,
  };
}


function textTransform(node) {
  const { polygon } = node;
  if (!polygon || polygon.length < 3) {
    return null;
  }
  
  const [cx, cy] = polygonCentroid(polygon);
  const measure = node.data.textMeasure;
  
  if (!measure || !measure.width || !measure.actualBoundingBoxAscent) {
    return null;
  }
  
  const r0 = Math.hypot(measure.width / 2, fontSize / 2);
  let r = Infinity;

  for (let i = 0; i < polygon.length; ++i) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const a = y2 - y1;
    const b = x1 - x2;
    const c = -(a * x1 + b * y1);
    const denominator = Math.hypot(a, b);
    if (denominator > 0) {
      r = Math.min(r, Math.abs(a * cx + b * cy + c) / denominator - 2);
    }
  }

  if (!isFinite(r) || r <= 0) {
    r = 10;
  }
  
  const s = Math.min(r / r0, 1);
  
  return {
    s: isFinite(s) ? s : 0.1,
    dx: isFinite(cx) ? cx - s * (measure.width / 2) : 0,
    dy: isFinite(cy) ? cy - s * (fontSize / 2 - measure.actualBoundingBoxAscent) : 0,
    a: 0,
    polygon: [
      [cx - s * (measure.width / 2), cy - s * (fontSize / 2)],
      [cx - s * (measure.width / 2), cy + s * (fontSize / 2)],
      [cx + s * (measure.width / 2), cy + s * (fontSize / 2)],
      [cx + s * (measure.width / 2), cy - s * (fontSize / 2)],
    ],
    lines: [node.data.word],
  };
}

function buildHierarchicalVoronoiTreemap(root, boundary, colorScale) {
  const allNodes = [];

  function processLevel(node, nodeBoundary, depth = 0) {
    console.log(`Processing level ${depth}, node:`, {
      id: node.data?.id,
      childrenCount: node.children?.length,
      value: node.value,
      height: node.height
    });

    if (!node.children || node.children.length === 0) {
      if (node.height === 0 && node.data.word) {
        node.polygon = nodeBoundary;
        node.color = node.parent ? node.parent.color : colorScale(node.data.id);
        allNodes.push(node);
      }
      return;
    }

    const totalWeight = d3.sum(node.children, (d) => d.value);
    const desiredAreas = node.children.map(
      (child) => child.value / totalWeight,
    );

    console.log(`Level ${depth} - Computing treemap for ${node.children.length} children with weights:`, 
      node.children.map(c => ({ id: c.data.id, value: c.value, ratio: c.value / totalWeight }))
    );

    const result = computeVoronoiTreemap(nodeBoundary, desiredAreas);

    node.children.forEach((child, i) => {
      if (result.cells[i] && result.cells[i].length > 0) {
        child.polygon = result.cells[i];
        child.generator = result.generators[i];
        child.weight = result.weights[i];

        if (child.depth === 1) {
          child.color = colorScale(child.data.id);
        } else if (node.color) {
          child.color = node.color;
        }

        if (child.height > 0) {
          allNodes.push(child);
        }

        processLevel(child, child.polygon, depth + 1);
      }
    });
  }

  root.polygon = boundary;
  root.color = "none";
  
  processLevel(root, boundary);

  console.log("Total nodes in allNodes:", allNodes.length);
  console.log("Leaf nodes:", allNodes.filter(n => n.height === 0).length);

  return allNodes;
}

async function layoutNonConvexVoronoiTreemap({
  data,
  outsideRegion,
  fontFamily,
  colorPalette,
}) {
  const weightScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.weight))
    .range([1, 30]);

  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  root.sum((d) => weightScale(d.weight));

  const colorScale = d3.scaleOrdinal(d3[colorPalette]);

  console.log("Data structure:", {
    totalData: data.length,
    rootChildren: root.children?.length,
    totalLeaves: root.leaves().length,
    hierarchy: root
  });

  const allNodes = buildHierarchicalVoronoiTreemap(
    root,
    outsideRegion,
    colorScale,
  );

  for (const node of allNodes) {
    node.fontFamily = fontFamily;
    if (
      node.height === 0 &&
      node.data &&
      node.data.word &&
      node.polygon &&
      node.polygon.length > 0
    ) {
      const transform = textTransform(node);
      if (transform) {
        node.textTransform = transform;
      }
    }
  }

  const convexHull = d3.polygonHull(outsideRegion);

  return {
    cells: allNodes.filter((node) => node.polygon && node.polygon.length > 0),
    convexHull: convexHull,
  };
}

onmessage = async (event) => {
  const { data, outsideRegion, fontFamily, colorPalette } = event.data;

  console.log("Worker received data:", {
    dataLength: data?.length,
    outsideRegionLength: outsideRegion?.length,
    fontFamily,
    colorPalette,
  });

  try {
    const result = await layoutNonConvexVoronoiTreemap({
      data,
      outsideRegion,
      fontFamily,
      colorPalette,
    });
    console.log("Worker result:", {
      cellsLength: result.cells?.length,
      convexHullLength: result.convexHull?.length,
    });
    postMessage(result);
  } catch (error) {
    console.error("Error in nonconvex voronoi worker:", error);
    postMessage({ error: error.message });
  }
};
