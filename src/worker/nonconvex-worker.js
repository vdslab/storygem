console.log("nonconvex-worker.js loaded");

import * as d3 from "d3";
import GLPK from "glpk.js";
import { makeLpObject } from "./lp";
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




// PW Power Diagram用: 半平面の2点を計算（sandbox clipping.ts準拠）
// Power distance: d_pw(pi, wi, q) = |q - pi|^2 - wi
// 境界線: |q - pi|^2 - wi = |q - pj|^2 - wj
function powerDiagramHalfPlane(pi, wi, pj, wj) {
  const dx = pj[0] - pi[0];
  const dy = pj[1] - pi[1];
  const c =
    pj[0] * pj[0] +
    pj[1] * pj[1] -
    pi[0] * pi[0] -
    pi[1] * pi[1] -
    wj +
    wi;

  // 直線上の1点を求める
  let px, py;
  if (Math.abs(dx) > 1e-10) {
    py = 0;
    px = c / (2 * dx);
  } else if (Math.abs(dy) > 1e-10) {
    px = 0;
    py = c / (2 * dy);
  } else {
    px = pi[0];
    py = pi[1];
  }

  // 直線の方向ベクトル（境界線の法線に垂直）
  const dirX = -dy;
  const dirY = dx;

  const scale = 10000;
  const p1 = [px + dirX * scale, py + dirY * scale];
  const p2 = [px - dirX * scale, py - dirY * scale];

  // 向き調整不要：元の p1/p2 の向きで clipPolygonByHalfPlanePoints が
  // 保持する領域は常に「2*dx*q.x + 2*dy*q.y <= c」= cell i の正しい半平面。
  // スワップすると重みが発散した際に逆の領域を保持してしまうため削除。
  return { p1, p2 };
}

// Sutherland-Hodgman半平面クリッピング（sandbox clipping.ts準拠）
// p1からp2への方向の左側が内側
function clipPolygonByHalfPlanePoints(polygon, p1, p2) {
  if (polygon.length === 0) return [];

  const a = p2[1] - p1[1];
  const b = p1[0] - p2[0];
  const c = -(a * p1[0] + b * p1[1]);

  function pointSide(p) {
    return a * p[0] + b * p[1] + c;
  }

  const clipped = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    const currentSide = pointSide(current);
    const nextSide = pointSide(next);

    const currentInside = currentSide >= -1e-10;
    const nextInside = nextSide >= -1e-10;

    if (currentInside) {
      clipped.push(current);
      if (!nextInside) {
        // 交点を計算
        const denom = (current[0] - next[0]) * (p1[1] - p2[1]) - (current[1] - next[1]) * (p1[0] - p2[0]);
        if (Math.abs(denom) > 1e-10) {
          const t = ((current[0] - p1[0]) * (p1[1] - p2[1]) - (current[1] - p1[1]) * (p1[0] - p2[0])) / denom;
          clipped.push([
            current[0] + t * (next[0] - current[0]),
            current[1] + t * (next[1] - current[1]),
          ]);
        }
      }
    } else {
      if (nextInside) {
        // 交点を計算
        const denom = (current[0] - next[0]) * (p1[1] - p2[1]) - (current[1] - next[1]) * (p1[0] - p2[0]);
        if (Math.abs(denom) > 1e-10) {
          const t = ((current[0] - p1[0]) * (p1[1] - p2[1]) - (current[1] - p1[1]) * (p1[0] - p2[0])) / denom;
          clipped.push([
            current[0] + t * (next[0] - current[0]),
            current[1] + t * (next[1] - current[1]),
          ]);
        }
      }
    }
  }

  return clipped;
}

// Power Diagramのセルを計算
// 戻り値: { cells: [polygon,...], cellAreas: [number,...] }
//
// アルゴリズム:
//   境界ポリゴンに対して直接 Sutherland-Hodgman で半平面クリップを適用する。
//   半平面（凸）でクリップする限り S-H は非凸境界でも面積を正確に計算できる。
//   polygon-clipping を使わないことで PNG由来の複雑なポリゴンでも正しく動作する。
//   ※ 非凸境界で切断領域が発生する場合、S-H結果は「零幅の接続辺」を含む非単純
//     ポリゴンになるが、ショールース公式による面積計算は依然として正確である。
function computePowerDiagramCells(generators, pwWeights, boundary, debugLog = false) {
  const n = generators.length;
  const cells = new Array(n);
  const cellAreas = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    // 境界ポリゴンから開始して各半平面でクリップ
    let cell = [...boundary];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      // 同一座標の母点ペアはスキップ（二等分線が定義できないため）
      const dx = generators[j][0] - generators[i][0];
      const dy = generators[j][1] - generators[i][1];
      if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) continue;

      const { p1, p2 } = powerDiagramHalfPlane(
        generators[i], pwWeights[i],
        generators[j], pwWeights[j]
      );

      cell = clipPolygonByHalfPlanePoints(cell, p1, p2);

      if (cell.length === 0) break;
    }

    cells[i] = cell.length >= 3 ? cell : [];
    cellAreas[i] = cell.length >= 3 ? polygonArea(cell) : 0;
  }

  if (debugLog) {
    const boundaryArea = polygonArea(boundary);
    const totalCellArea = cellAreas.reduce((s, a) => s + a, 0);
    const emptyCells = cells.filter(c => !c || c.length === 0).length;
    console.log(`[PD] n=${n}, empty=${emptyCells}, totalCellArea=${(totalCellArea/boundaryArea*100).toFixed(1)}% of boundary`);
    if (Math.abs(totalCellArea - boundaryArea) / boundaryArea > 0.05) {
      console.warn(`[PD] area mismatch! boundary=${boundaryArea.toFixed(1)}, cells sum=${totalCellArea.toFixed(1)}`);
    }
  }

  return { cells, cellAreas };
}




function computeVoronoiTreemap(
  boundary,
  desiredAreas,
  maxIterations = 200,
  epsilon = 0.01,
  initialPoints = null,
) {
  const n = desiredAreas.length;
  const totalArea = polygonArea(boundary);

  if (n === 0) return { cells: [], generators: [], weights: [], iterations: 0 };
  if (n === 1) return { cells: [boundary], generators: [polygonCentroid(boundary)], weights: [1], iterations: 0 };

  const [xMin, xMax] = d3.extent(boundary, (p) => p[0]);
  const [yMin, yMax] = d3.extent(boundary, (p) => p[1]);

  // 初期生成点の配置
  let generators;
  if (initialPoints && initialPoints.length === n) {
    // 境界外の初期点はランダムな内部点で代替（centroidは非凸領域で境界外になりうるため使わない）
    generators = initialPoints.map(p =>
      pointInPolygon(p, boundary) ? [...p] : randomPointInPolygon(boundary)
    );
  } else {
    // グリッド配置 + ランダムフォールバック
    generators = [];
    if (n === 1) {
      generators.push(polygonCentroid(boundary));
    } else {
      const gridSize = Math.ceil(Math.sqrt(n));
      const cellWidth = (xMax - xMin) / gridSize;
      const cellHeight = (yMax - yMin) / gridSize;

      let index = 0;
      for (let i = 0; i < gridSize && index < n; i++) {
        for (let j = 0; j < gridSize && index < n; j++) {
          const x = xMin + (j + 0.5) * cellWidth;
          const y = yMin + (i + 0.5) * cellHeight;
          if (pointInPolygon([x, y], boundary)) {
            generators.push([x, y]);
            index++;
          }
        }
      }
      let attempts = 0;
      while (generators.length < n && attempts < n * 100) {
        const x = xMin + Math.random() * (xMax - xMin);
        const y = yMin + Math.random() * (yMax - yMin);
        if (pointInPolygon([x, y], boundary)) {
          generators.push([x, y]);
        }
        attempts++;
      }
    }
  }

  // 不足分を randomPointInPolygon で補完する（非凸境界でグリッドが失敗した場合のフォールバック）
  while (generators.length < n) {
    generators.push(randomPointInPolygon(boundary));
  }

  // 初期重み（PW式: desiredArea * 100）
  let pwWeights = desiredAreas.map(a => a * 100);

  let iteration = 0;
  let converged = false;
  let cells = [];
  let lastCellAreas = new Array(n).fill(0); // 最終イテレーションの面積（ログ用）

  while (!converged && iteration < maxIterations) {
    // 1) Power Diagramを計算
    const debugLog = (iteration === 0);
    const pdResult = computePowerDiagramCells(generators, pwWeights, boundary, debugLog);
    cells = pdResult.cells;
    const cellAreas = pdResult.cellAreas;
    lastCellAreas = cellAreas;

    // 2) 面積比を計算（全ピース合計を使用）
    const currentAreas = cellAreas.map(area => area / totalArea);

    // 3) 収束チェック
    converged = true;
    let maxError = 0;
    for (let i = 0; i < n; i++) {
      const error = Math.abs(currentAreas[i] - desiredAreas[i]);
      maxError = Math.max(maxError, error);
      if (error >= epsilon) converged = false;
    }

    if (iteration % 50 === 0 || iteration === 0) {
      console.log(`Iteration ${iteration}: maxError=${(maxError * 100).toFixed(2)}%`);
    }

    if (converged) {
      console.log(`Converged after ${iteration} iterations`);
      break;
    }

    // 4) 重みをPW式で更新
    // clampの上限をイテレーションとともに減衰させることでlimit cycle（振動）を防ぐ
    const maxClamp = Math.max(0.05, 0.9 * (1 - iteration / maxIterations));
    for (let i = 0; i < n; i++) {
      if (desiredAreas[i] <= 0) continue;
      const error = desiredAreas[i] - currentAreas[i];
      const ratio = error / desiredAreas[i];
      const clamped = Math.max(-maxClamp, Math.min(maxClamp, ratio));
      pwWeights[i] = Math.max(0.0001, Math.min(100000, pwWeights[i] * (1 + clamped)));
    }

    // 5) 生成点を重心に移動（CVTステップ）
    for (let i = 0; i < n; i++) {
      if (cells[i] && cells[i].length > 0) {
        const c = polygonCentroid(cells[i]);
        if (isFinite(c[0]) && isFinite(c[1])) {
          generators[i] = c;
        }
        // NaN/Infinityの場合は生成点を維持（退化セルによる数値エラーを防ぐ）
      }
      // セルが空の場合: 重みが増加するので次回イテレーションで改善される
    }

    iteration++;
  }

  // 収束・失敗問わず常に最終面積サマリーを出力
  {
    const finalAreas = lastCellAreas.map(a => a / totalArea);
    const finalAreaSum = finalAreas.reduce((s, a) => s + a, 0);
    const status = converged ? "OK" : "WARN(not converged)";
    const emptyCnt = cells.filter(c => !c || c.length === 0).length;
    console.log(`[AREA] ${status} | sum=${(finalAreaSum * 100).toFixed(1)}% | empty=${emptyCnt} | n=${n}`);
    finalAreas.forEach((a, i) => {
      const d = desiredAreas[i];
      const errPct = (a - d) * 100;
      const mark = Math.abs(errPct) > 2 ? " ⚠" : "";
      console.log(`  [${i}] desired=${(d*100).toFixed(2)}%  actual=${(a*100).toFixed(2)}%  err=${errPct >= 0 ? "+" : ""}${errPct.toFixed(2)}%${mark}`);
    });
  }

  return {
    cells,
    generators,
    weights: pwWeights,
    iterations: iteration,
  };
}


function getConvexHull(image) {
  const dx = 10;
  const dy = image.height / 2;
  const points = [];
  for (let i = 0; i < image.height; ++i) {
    for (let j = 0; j < image.width; ++j) {
      if (image.data[4 * (image.width * i + j) + 3] > 0) {
        const x = j - dx;
        const y = i - dy;
        const margin = 1.5;
        points.push([x + 0.5 - margin, y + 0.5 - margin]);
        points.push([x + 0.5 + margin, y + 0.5 - margin]);
        points.push([x + 0.5 - margin, y + 0.5 + margin]);
        points.push([x + 0.5 + margin, y + 0.5 + margin]);
      }
    }
  }

  const q = [];
  let p0 = points[0];
  do {
    q.push(p0);
    let p1 = points[0];
    for (let i = 1; i < points.length; ++i) {
      const p2 = points[i];
      if (p0 === p1) {
        p1 = p2;
      } else {
        const x10 = p1[0] - p0[0];
        const x20 = p2[0] - p0[0];
        const y10 = p1[1] - p0[1];
        const y20 = p2[1] - p0[1];
        const v = x10 * y20 - x20 * y10;
        if (
          v > 0 ||
          (v === 0 && x20 * x20 + y20 * y20 > x10 * x10 + y10 * y10)
        ) {
          p1 = p2;
        }
      }
    }
    p0 = p1;
  } while (p0 !== q[0]);
  return q;
}

function convert2DArrayTo1DArray(array2D) {
  const arrayX = [];
  const arrayY = [];
  for (let i = 0; i < array2D.length; i++) {
    arrayX.push(array2D[i][0]);
    arrayY.push(array2D[i][1]);
  }
  return [arrayX, arrayY];
}

function sortVerticesClockwise(vertice) {
  const vertices = vertice.concat();
  let leftMost = vertices[0];
  let leftMostIndex = 0;
  for (let i = 1; i < vertices.length; i++) {
    if (vertices[i][0] < leftMost[0]) {
      leftMost = vertices[i];
      leftMostIndex = i;
    } else if (vertices[i][0] === leftMost[0] && vertices[i][1] < leftMost[1]) {
      leftMost = vertices[i];
      leftMostIndex = i;
    }
  }

  const sortedVertices = [];
  sortedVertices.push(vertices[leftMostIndex]);
  vertices.splice(leftMostIndex, 1);
  vertices.sort(
    (a, b) => getAngle(sortedVertices[0], a) - getAngle(sortedVertices[0], b),
  );

  return sortedVertices.concat(vertices);
}

function getAngle(p1, p2) {
  const deltaX = p2[0] - p1[0];
  const deltaY = p2[1] - p1[1];
  return Math.atan2(deltaY, deltaX);
}

function calcResizeValue(data, px, py, qx, qy) {
  const vars = data.vars;
  let resizeX = [0, 0],
    resizeY = [0, 0];
  for (let i = 0; i < px.length; i++) {
    const lambdaName1 = `lambda1_${i + 1}`;
    const lambdaName2 = `lambda2_${i + 1}`;
    resizeX[0] += vars[lambdaName1] * px[i];
    resizeX[1] += vars[lambdaName2] * px[i];
    resizeY[0] += vars[lambdaName1] * py[i];
    resizeY[1] += vars[lambdaName2] * py[i];
  }
  const S =
    Math.hypot(qx[1] - qx[0], qy[1] - qy[0]) /
    Math.hypot(resizeX[1] - resizeX[0], resizeY[1] - resizeY[0]);
  const dx = qx[0] / S - resizeX[0];
  const dy = qy[0] / S - resizeY[0];
  return [1 / S, -dx, -dy];
}

function rotate(q, theta) {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return q.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

function isConvex(polygon) {
  const n = polygon.length;
  if (n < 3) return false;
  
  let sign = null;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    const p3 = polygon[(i + 2) % n];
    
    const crossProduct = (p2[0] - p1[0]) * (p3[1] - p2[1]) - (p2[1] - p1[1]) * (p3[0] - p2[0]);
    
    if (Math.abs(crossProduct) > 1e-10) {
      const currentSign = crossProduct > 0;
      if (sign === null) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
  }
  
  return true;
}

async function textTransform(node, sizeOptimization, glpk) {
  const { polygon } = node;
  if (!polygon || polygon.length < 3) {
    return null;
  }
  
  // デバッグ用：breadの場合は詳細をログ出力
  if (node.data.word === "bread") {
    console.log("Processing bread text placement:", {
      polygon: polygon,
      area: polygonArea(polygon),
      centroid: polygonCentroid(polygon)
    });
  }
  
  const convexHullPolygon = d3.polygonHull(polygon);
  
  if (sizeOptimization && convexHullPolygon && isConvex(convexHullPolygon)) {
    const { rotateStep } = sizeOptimization;
    let s = 0;
    let dx = 0;
    let dy = 0;
    let a = 0;
    let resultText = null;
    let textPolygon = null;

    const [px, py] = convert2DArrayTo1DArray(sortVerticesClockwise(convexHullPolygon));
    const radianList = [0];
    if (rotateStep) {
      for (let t = rotateStep; t <= 90; t += rotateStep) {
        radianList.push((Math.PI * t) / 180);
        radianList.push((-Math.PI * t) / 180);
      }
    }
    
    for (let radian of radianList) {
      for (const { lines, imageData } of node.data.wordPixels) {
        const [qx, qy] = convert2DArrayTo1DArray(
          sortVerticesClockwise(rotate(getConvexHull(imageData), radian)),
        );
        const [objective, subjectTo] = makeLpObject(px, py, qx, qy);
        const options = {
          msglev: glpk.GLP_MSG_ERR,
          presol: false,
        };
        const { result } = await glpk.solve(
          {
            name: "LP",
            objective: objective,
            subjectTo: subjectTo,
          },
          options,
        );
        const [stateS, statedx, statedy] = calcResizeValue(
          result,
          px,
          py,
          qx,
          qy,
        );
        
        // スケーリングを100%に設定（最大限活用）
        const testScale = stateS * 1.0;
        const testDx = statedx;
        const testDy = statedy;
        
        const textCorners = [];
        for (let j = 0; j < qx.length; j++) {
          let x = 0;
          let y = 0;
          for (let i = 0; i < px.length; i++) {
            const lambdaName1 = `lambda${j + 1}_${i + 1}`;
            x += result.vars[lambdaName1] * px[i];
            y += result.vars[lambdaName1] * py[i];
          }
          textCorners.push([x, y]);
        }
        
        // 境界チェック（簡略化してパフォーマンスと表示率を改善）
        let allInside = true;
        
        for (const corner of textCorners) {
          if (!pointInPolygon(corner, polygon)) {
            allInside = false;
            break;
          }
        }
        
        let finalScale = testScale;
        if (!allInside) {
          // より細かい二分探索
          let low = 0;
          let high = testScale;
          const iterations = 20; // 反復回数を増やす
          
          for (let iter = 0; iter < iterations; iter++) {
            const mid = (low + high) / 2;
            const midCorners = textCorners.map(([x, y]) => {
              const scaledX = testDx + (x - testDx) * (mid / testScale);
              const scaledY = testDy + (y - testDy) * (mid / testScale);
              return [scaledX, scaledY];
            });
            
            let midAllInside = true;
            for (const corner of midCorners) {
              if (!pointInPolygon(corner, polygon)) {
                midAllInside = false;
                break;
              }
            }
            
            if (midAllInside) {
              low = mid;
            } else {
              high = mid;
            }
          }
          
          finalScale = low; // 安全マージンを削除
        }
        
        if (finalScale > s) {
          s = finalScale;
          dx = testDx;
          dy = testDy;
          a = radian * (180 / Math.PI);
          resultText = lines;
          textPolygon = textCorners.map(([x, y]) => {
            const scaledX = dx + (x - dx) * (s / testScale);
            const scaledY = dy + (y - dy) * (s / testScale);
            return [scaledX, scaledY];
          });
        }
      }
    }

    // LP が有効なスケールを見つけられなかった場合は null を返す（テキストを非表示）
    if (resultText === null) return null;
    return { s, dx, dy, a, polygon: textPolygon, lines: resultText };
  } else {
    // 凸包が凸多角形でない場合、または最適化が無効な場合は従来の方法を使用
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
    
    // スケーリング（最大95%に緩和）
    const s = Math.min(r / r0, 0.95); // 最大95%に制限
    
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
}

// ポリゴン内のランダムな点を生成（rejection sampling）
// 非凸領域でも正しく境界内の点を返す
function randomPointInPolygon(polygon) {
  const xMin = Math.min(...polygon.map(p => p[0]));
  const xMax = Math.max(...polygon.map(p => p[0]));
  const yMin = Math.min(...polygon.map(p => p[1]));
  const yMax = Math.max(...polygon.map(p => p[1]));

  for (let i = 0; i < 2000; i++) {
    const x = xMin + Math.random() * (xMax - xMin);
    const y = yMin + Math.random() * (yMax - yMin);
    if (pointInPolygon([x, y], polygon)) return [x, y];
  }
  // フォールバック: ポリゴンの最初の頂点付近の内側点を探す
  for (const p of polygon) {
    const cx = (p[0] + xMin + xMax) / 3;
    const cy = (p[1] + yMin + yMax) / 3;
    if (pointInPolygon([cx, cy], polygon)) return [cx, cy];
  }
  return [...polygon[0]];
}

// ネットワーク座標系からポリゴン座標系へスケーリング（sandbox geometry.ts準拠）
// points: [[x,y],...] (API座標 ≈ [-1, 1]範囲)
// polygon: 対象領域の境界
// 戻り値: polygon内に80%スケールで収まる座標配列
function scalePointsToPolygon(points, polygon) {
  if (points.length === 0 || polygon.length === 0) return [];

  const minX = Math.min(...polygon.map(p => p[0]));
  const maxX = Math.max(...polygon.map(p => p[0]));
  const minY = Math.min(...polygon.map(p => p[1]));
  const maxY = Math.max(...polygon.map(p => p[1]));

  const polyWidth = maxX - minX;
  const polyHeight = maxY - minY;

  const pointsMinX = Math.min(...points.map(p => p[0]));
  const pointsMaxX = Math.max(...points.map(p => p[0]));
  const pointsMinY = Math.min(...points.map(p => p[1]));
  const pointsMaxY = Math.max(...points.map(p => p[1]));

  const pointsWidth = pointsMaxX - pointsMinX;
  const pointsHeight = pointsMaxY - pointsMinY;

  const scale = Math.min(
    (polyWidth * 0.8) / (pointsWidth || 1),
    (polyHeight * 0.8) / (pointsHeight || 1)
  );

  const srcCX = pointsMinX + pointsWidth / 2;
  const srcCY = pointsMinY + pointsHeight / 2;
  const dstCX = minX + polyWidth / 2;
  const dstCY = minY + polyHeight / 2;

  return points.map(p => [
    dstCX + (p[0] - srcCX) * scale,
    dstCY + (p[1] - srcCY) * scale,
  ]);
}

// 中間ノードに葉ノードの加重平均位置を計算（後順traversal）
function computePositionsForAllNodes(root) {
  function assignPosition(node) {
    if (!node.children || node.children.length === 0) {
      // 葉ノード: data.x, data.y をそのまま使用
      return;
    }
    node.children.forEach(assignPosition);
    const totalW = d3.sum(node.children, c => c.value);
    if (totalW > 0) {
      const xSum = d3.sum(node.children, c => {
        const x = c.data.x;
        return x !== undefined ? x * c.value : 0;
      });
      const ySum = d3.sum(node.children, c => {
        const y = c.data.y;
        return y !== undefined ? y * c.value : 0;
      });
      const hasAnyX = node.children.some(c => c.data.x !== undefined);
      if (hasAnyX) {
        node.data.x = xSum / totalW;
        node.data.y = ySum / totalW;
      }
    }
  }
  assignPosition(root);
}

function buildHierarchicalVoronoiTreemap(root, boundary, colorScale, useInitialPositions = true) {
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
    
    // 初期点の抽出と渡し
    let initialPoints = null;
    if (useInitialPositions) {
      const hasAllPositions = node.children.every(c =>
        c.data.x !== undefined && c.data.y !== undefined
      );
      if (hasAllPositions) {
        const rawPoints = node.children.map(c => [c.data.x, c.data.y]);
        initialPoints = scalePointsToPolygon(rawPoints, nodeBoundary);
      }
    }

    const result = computeVoronoiTreemap(nodeBoundary, desiredAreas, 200, 0.01, initialPoints);

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
  sizeOptimization,
  colorPalette,
  useInitialPositions = true,
  glpk,
}) {
  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  root.sum((d) => d.weight || 0);

  const colorScale = d3.scaleOrdinal(d3[colorPalette]);

  // 中間ノードの位置を葉ノードから計算
  if (useInitialPositions) {
    computePositionsForAllNodes(root);
  }

  const allNodes = buildHierarchicalVoronoiTreemap(
    root,
    outsideRegion,
    colorScale,
    useInitialPositions,
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
      const transform = await textTransform(node, sizeOptimization, glpk);
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
  const { data, outsideRegion, fontFamily, sizeOptimization, colorPalette, useInitialPositions } = event.data;

  try {
    const glpk = await GLPK();
    const result = await layoutNonConvexVoronoiTreemap({
      data,
      outsideRegion,
      fontFamily,
      sizeOptimization,
      colorPalette,
      useInitialPositions: useInitialPositions !== false,
      glpk,
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
