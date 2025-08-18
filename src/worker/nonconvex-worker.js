console.log("nonconvex-worker.js loaded");

import * as d3 from "d3";
import polygonClipping from "polygon-clipping";
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




// パワー距離を計算する関数
function powerDistance(point, site, weight) {
  const dx = point[0] - site[0];
  const dy = point[1] - site[1];
  return dx * dx + dy * dy - weight * weight;
}

// 点がどのサイトに属するかを判定
function assignPointToSite(point, sites, weights) {
  let minDistance = Infinity;
  let assignedSite = -1;
  
  for (let i = 0; i < sites.length; i++) {
    const dist = powerDistance(point, sites[i], weights[i]);
    if (dist < minDistance) {
      minDistance = dist;
      assignedSite = i;
    }
  }
  
  return assignedSite;
}

// 2つのサイト間のパワー境界線（直線）を計算
function computePowerBisector(site1, site2, weight1, weight2) {
  const [x1, y1] = site1;
  const [x2, y2] = site2;
  const w1sq = weight1 * weight1;
  const w2sq = weight2 * weight2;
  
  // パワー境界線の方程式: 2(x2-x1)x + 2(y2-y1)y = x2²-x1² + y2²-y1² + w1²-w2²
  const a = 2 * (x2 - x1);
  const b = 2 * (y2 - y1);
  const c = x2 * x2 - x1 * x1 + y2 * y2 - y1 * y1 + w1sq - w2sq;
  
  return { a, b, c }; // ax + by = c
}


// 半平面でポリゴンをクリップ
function clipPolygonByHalfPlane(polygon, line, keepSide) {
  const { a, b, c } = line;
  const clipped = [];
  const epsilon = 1e-10;
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[j];
    
    const side1 = a * x1 + b * y1 - c;
    const side2 = a * x2 + b * y2 - c;
    
    const inSide1 = keepSide ? side1 <= epsilon : side1 >= -epsilon;
    const inSide2 = keepSide ? side2 <= epsilon : side2 >= -epsilon;
    
    if (inSide1) {
      clipped.push([x1, y1]);
    }
    
    if ((inSide1 && !inSide2) || (!inSide1 && inSide2)) {
      // エッジが境界線と交差
      const denominator = side1 - side2;
      if (Math.abs(denominator) > epsilon) {
        const t = side1 / denominator;
        if (t >= 0 && t <= 1) {
          clipped.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
        }
      }
    }
  }
  
  return clipped;
}

// パワー図のセルを計算する関数（共有境界版）
function computeClippedVoronoiCells(generators, weights, boundary, desiredAreas = null) {
  const n = generators.length;
  
  // 境界の範囲を取得
  const xMin = Math.min(...boundary.map(p => p[0]));
  const xMax = Math.max(...boundary.map(p => p[0]));
  const yMin = Math.min(...boundary.map(p => p[1]));
  const yMax = Math.max(...boundary.map(p => p[1]));
  
  // 重みを正規化
  const totalArea = polygonArea(boundary);
  let normalizedWeights;
  
  if (desiredAreas) {
    normalizedWeights = desiredAreas.map((ratio) => {
      const targetArea = ratio * totalArea;
      return Math.sqrt(targetArea / Math.PI) * 0.7; // 重なりを防ぐため調整
    });
  } else {
    const totalWeight = d3.sum(weights);
    normalizedWeights = weights.map(w => {
      const targetAreaRatio = w / totalWeight;
      const targetArea = targetAreaRatio * totalArea;
      return Math.sqrt(targetArea / Math.PI) * 0.7; // 重なりを防ぐため調整
    });
  }
  
  // 全てのパワー境界線を事前に計算
  const bisectors = {};
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const bisector = computePowerBisector(
        generators[i], 
        generators[j], 
        normalizedWeights[i], 
        normalizedWeights[j]
      );
      bisectors[`${i}-${j}`] = bisector;
      bisectors[`${j}-${i}`] = { 
        a: -bisector.a, 
        b: -bisector.b, 
        c: -bisector.c 
      };
    }
  }
  
  // 隣接関係を判定するためのグリッドサンプリング
  const resolution = 100; // 隣接判定用なので低解像度でOK
  const dx = (xMax - xMin) / resolution;
  const dy = (yMax - yMin) / resolution;
  
  // 隣接セルを検出
  const neighbors = Array(n).fill(null).map(() => new Set());
  
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = xMin + (i + 0.5) * dx;
      const y = yMin + (j + 0.5) * dy;
      const point = [x, y];
      
      if (pointInPolygon(point, boundary)) {
        const site1 = assignPointToSite(point, generators, normalizedWeights);
        
        // 隣接点をチェック
        const offsets = [[1, 0], [0, 1], [1, 1], [1, -1]];
        for (const [di, dj] of offsets) {
          const ni = i + di;
          const nj = j + dj;
          if (ni >= 0 && ni < resolution && nj >= 0 && nj < resolution) {
            const nx = xMin + (ni + 0.5) * dx;
            const ny = yMin + (nj + 0.5) * dy;
            const npoint = [nx, ny];
            
            if (pointInPolygon(npoint, boundary)) {
              const site2 = assignPointToSite(npoint, generators, normalizedWeights);
              if (site1 !== site2 && site1 >= 0 && site2 >= 0) {
                neighbors[site1].add(site2);
                neighbors[site2].add(site1);
              }
            }
          }
        }
      }
    }
  }
  
  // セルを構築（共有境界を使用）
  const cells = new Array(n);
  const processedPairs = new Set();
  
  // 重みでソートしてインデックスを取得（大きい順）
  const sortedIndices = Array.from({length: n}, (_, i) => i)
    .sort((a, b) => normalizedWeights[b] - normalizedWeights[a]);
  
  // 各セルを構築
  for (const i of sortedIndices) {
    // 初期セルを大きな矩形として設定
    const margin = Math.max(xMax - xMin, yMax - yMin) * 2;
    let cell = [
      [xMin - margin, yMin - margin],
      [xMax + margin, yMin - margin],
      [xMax + margin, yMax + margin],
      [xMin - margin, yMax + margin]
    ];
    
    // 隣接セルとの境界で切り取る
    for (const j of neighbors[i]) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      const bisectorKey = `${i}-${j}`;
      
      if (bisectors[bisectorKey]) {
        const bisector = bisectors[bisectorKey];
        
        // サイトiの側を保持
        const [xi, yi] = generators[i];
        const side = bisector.a * xi + bisector.b * yi - bisector.c;
        cell = clipPolygonByHalfPlane(cell, bisector, side <= 0);
        
        if (cell.length < 3) break;
        
        // この境界を処理済みとしてマーク
        processedPairs.add(key);
      }
    }
    
    // 隣接していないセルとも境界を計算（安全のため）
    for (let j = 0; j < n; j++) {
      if (i !== j && !neighbors[i].has(j)) {
        const bisectorKey = `${i}-${j}`;
        if (bisectors[bisectorKey]) {
          const bisector = bisectors[bisectorKey];
          
          // サイトiの側を保持
          const [xi, yi] = generators[i];
          const side = bisector.a * xi + bisector.b * yi - bisector.c;
          cell = clipPolygonByHalfPlane(cell, bisector, side <= 0);
          
          if (cell.length < 3) break;
        }
      }
    }
    
    // 境界でクリップ
    if (cell.length >= 3) {
      try {
        const intersection = polygonClipping.intersection([cell], [boundary]);
        if (intersection.length > 0 && intersection[0].length > 0) {
          cells[i] = intersection[0][0];
        } else {
          cells[i] = [];
        }
      } catch (e) {
        console.error(`Clipping error for cell ${i}:`, e);
        cells[i] = [];
      }
    } else {
      cells[i] = [];
    }
  }
  
  // 重なり検出と修正
  for (let i = 0; i < n; i++) {
    if (!cells[i] || cells[i].length < 3) continue;
    
    for (let j = i + 1; j < n; j++) {
      if (!cells[j] || cells[j].length < 3) continue;
      
      // 重なりをチェック
      try {
        const intersection = polygonClipping.intersection([cells[i]], [cells[j]]);
        if (intersection.length > 0 && intersection[0].length > 0) {
          // 重なりがある場合、境界線で正確に分割
          const bisectorKey = `${i}-${j}`;
          if (bisectors[bisectorKey]) {
            const bisector = bisectors[bisectorKey];
            
            // 両方のセルを境界線で再分割
            const [xi, yi] = generators[i];
            const sidei = bisector.a * xi + bisector.b * yi - bisector.c;
            
            cells[i] = clipPolygonByHalfPlane(cells[i], bisector, sidei <= 0);
            cells[j] = clipPolygonByHalfPlane(cells[j], bisector, sidei > 0);
          }
        }
      } catch (e) {
        // エラーは無視
      }
    }
  }
  
  return cells;
}

// セルの後処理（削除）- 使用されていないため削除




function computeVoronoiTreemap(
  boundary,
  desiredAreas,
  weights = null,
  maxIterations = 100, // 最大反復回数を大幅に削減
  epsilon = 0.15, // 収束判定の閾値を緩和
) {
  const n = desiredAreas.length;
  const totalArea = polygonArea(boundary);

  console.log("computeVoronoiTreemap:", {
    n,
    totalArea,
    desiredAreas,
    weights,
    boundaryPoints: boundary.length,
  });

  // 初期サイトの配置を改善（重みに基づいた配置）
  const generators = [];
  const [xMin, xMax] = d3.extent(boundary, (p) => p[0]);
  const [yMin, yMax] = d3.extent(boundary, (p) => p[1]);
  
  // 重みに基づいて初期位置を決定
  if (n === 1) {
    // 1つの場合は中心に配置
    generators.push(polygonCentroid(boundary));
  } else if (n === 2) {
    // 2つの場合は重みに応じて配置
    const ratio = desiredAreas[0];
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const dx = (xMax - xMin) * 0.25;
    
    generators.push([cx - dx * (1 - ratio), cy]);
    generators.push([cx + dx * ratio, cy]);
  } else {
    // 3つ以上の場合は、重み付き重心を考慮したグリッド配置
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
    
    // 不足分はランダムに追加
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

  console.log("Initial generators:", generators.length);

  // 重みが指定されていない場合は均等な重みを使用
  if (!weights) {
    weights = new Array(n).fill(1);
  }

  let iteration = 0;
  let stable = false;

  while (!stable && iteration < maxIterations) {
    const cells = computeClippedVoronoiCells(generators, weights, boundary, desiredAreas);

    const actualAreas = cells.map((cell) =>
      cell && cell.length > 0 ? polygonArea(cell) : 0,
    );

    if (iteration === 0 || iteration % 20 === 0) {
      console.log(`Iteration ${iteration} cells:`, {
        cellsCount: cells.length,
        nonEmptyCells: cells.filter((c) => c.length > 0).length,
        actualAreas: actualAreas.slice(0, 5),
      });
    }

    // 目標面積を計算（重みに基づく）
    const targetAreas = desiredAreas.map(ratio => ratio * totalArea);
    
    stable = true;
    let maxRelativeError = 0;
    let totalError = 0;
    
    for (let i = 0; i < n; i++) {
      if (actualAreas[i] > 0 && targetAreas[i] > 0) {
        const actualRatio = actualAreas[i] / totalArea;
        const desiredRatio = desiredAreas[i];
        const relativeError = Math.abs(actualRatio - desiredRatio) / desiredRatio;
        
        maxRelativeError = Math.max(maxRelativeError, relativeError);
        totalError += relativeError;

        if (relativeError >= epsilon) {
          stable = false;
        }
      }
    }
    
    if (iteration % 20 === 0) {
      console.log(`Iteration ${iteration} - Max relative error: ${maxRelativeError.toFixed(4)}, Total error: ${totalError.toFixed(4)}`);
    }

    if (!stable) {
      // パワー図に対応したLloyd反復
      // 動的な学習率（収束が進むにつれて減少）
      const baseLearningRate = 0.7; // 学習率を上げて収束を早める
      const decayFactor = Math.max(0.2, 1 - iteration / maxIterations);
      const learningRate = baseLearningRate * decayFactor;
      
      // 重みの更新も考慮
      const newWeights = [...weights];
      
      generators.forEach((gen, i) => {
        if (cells[i] && cells[i].length > 0 && actualAreas[i] > 0 && targetAreas[i] > 0) {
          const centroid = polygonCentroid(cells[i]);
          
          // 面積比を計算
          const areaRatio = targetAreas[i] / actualAreas[i];
          
          // 重みの調整をより積極的に行う
          if (Math.abs(areaRatio - 1) > 0.05) {
            // 面積比に応じて重みを調整
            newWeights[i] = weights[i] * Math.sqrt(areaRatio);
          }
          
          // サイト位置も重心に向かって移動
          const newGen = [
            gen[0] + learningRate * (centroid[0] - gen[0]),
            gen[1] + learningRate * (centroid[1] - gen[1])
          ];
          
          // 新しい位置が境界内にあることを確認
          if (pointInPolygon(newGen, boundary)) {
            generators[i] = newGen;
          } else {
            // 境界外の場合は、境界に向かって少しずつ移動
            const stepSize = 0.9;
            let currentPoint = gen;
            let nextPoint = newGen;
            
            // 二分探索で境界内の最大移動距離を見つける
            for (let j = 0; j < 10; j++) {
              const midPoint = [
                currentPoint[0] + stepSize * (nextPoint[0] - currentPoint[0]),
                currentPoint[1] + stepSize * (nextPoint[1] - currentPoint[1])
              ];
              
              if (pointInPolygon(midPoint, boundary)) {
                generators[i] = midPoint;
                break;
              }
            }
          }
        }
      });
      
      // 重みを更新
      weights = newWeights;
    }

    iteration++;
  }

  const finalCells = computeClippedVoronoiCells(generators, weights, boundary, desiredAreas);
  
  // 最終的な面積を計算して比較
  const finalAreas = finalCells.map((cell) =>
    cell && cell.length > 0 ? polygonArea(cell) : 0
  );
  
  console.log("Final area comparison:");
  for (let i = 0; i < n; i++) {
    if (finalAreas[i] > 0) {
      const actualRatio = finalAreas[i] / totalArea;
      const targetRatio = desiredAreas[i];
      console.log(`Cell ${i}: target=${(targetRatio * 100).toFixed(2)}%, actual=${(actualRatio * 100).toFixed(2)}%, weight=${weights[i]}`);
    }
  }

  return {
    cells: finalCells,
    generators: generators,
    weights: weights,
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
    
    // 各子ノードの重みを抽出
    const childWeights = node.children.map((child) => child.value);

    console.log(`Level ${depth} - Computing treemap for ${node.children.length} children with weights:`, 
      node.children.map(c => ({ 
        id: c.data.id, 
        value: c.value, 
        ratio: c.value / totalWeight,
        originalData: c.data.data
      }))
    );
    
    // デバッグ用：重みの分布を確認
    console.log(`Weight distribution at level ${depth}:`, {
      min: Math.min(...childWeights),
      max: Math.max(...childWeights),
      avg: totalWeight / node.children.length,
      weights: childWeights
    });

    const result = computeVoronoiTreemap(nodeBoundary, desiredAreas, childWeights);

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
  glpk,
}) {
  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  // 重みをそのまま使用（スケーリングしない）
  root.sum((d) => d.weight || 0);

  const colorScale = d3.scaleOrdinal(d3[colorPalette]);

  // データ構造の詳細をログ出力
  console.log("Data structure:", {
    totalData: data.length,
    rootChildren: root.children?.length,
    totalLeaves: root.leaves().length,
    hierarchy: root
  });
  
  // 階層ごとの重み分布を確認
  console.log("Hierarchical weight distribution:");
  function logHierarchy(node, depth = 0) {
    const indent = "  ".repeat(depth);
    if (node.children) {
      const childrenWeights = node.children.map(c => ({
        id: c.data.id,
        value: c.value,
        childCount: c.children?.length || 0
      }));
      console.log(`${indent}Node ${node.data.id}: value=${node.value}, children=${childrenWeights.length}`);
      childrenWeights.forEach(cw => {
        console.log(`${indent}  - ${cw.id}: value=${cw.value}, hasChildren=${cw.childCount > 0}`);
      });
      node.children.forEach(child => logHierarchy(child, depth + 1));
    }
  }
  logHierarchy(root);

  const allNodes = buildHierarchicalVoronoiTreemap(
    root,
    outsideRegion,
    colorScale,
  );

  // 総面積を計算
  const totalArea = polygonArea(outsideRegion);
  
  // 葉ノードの面積と重みの関係を確認
  const leafNodes = allNodes.filter(n => n.height === 0);
  console.log("Leaf nodes area vs weight comparison:");
  
  // 同じ親を持つ葉ノードをグループ化
  const nodesByParent = {};
  leafNodes.forEach(node => {
    const parentId = node.parent?.data?.id || "root";
    if (!nodesByParent[parentId]) {
      nodesByParent[parentId] = [];
    }
    nodesByParent[parentId].push(node);
  });
  
  // 各グループ内で面積と重みの比較
  Object.entries(nodesByParent).forEach(([parentId, nodes]) => {
    console.log(`\nParent: ${parentId}`);
    const parentTotalArea = nodes.reduce((sum, n) => sum + polygonArea(n.polygon), 0);
    nodes.forEach(node => {
      const nodeArea = polygonArea(node.polygon);
      const areaRatio = nodeArea / parentTotalArea;
      console.log(`  ${node.data.word}: weight=${node.value}, area=${nodeArea.toFixed(2)}, ratio=${(areaRatio * 100).toFixed(2)}%`);
    });
  });
  
  for (const node of allNodes) {
    node.fontFamily = fontFamily;
    
    // 各ノードの実際の面積を計算
    if (node.polygon && node.polygon.length > 0) {
      node.actualArea = polygonArea(node.polygon);
      node.areaRatio = node.actualArea / totalArea;
    }
    
    // 元の重み情報も保持
    if (node.data && node.data.data) {
      node.originalWeight = node.data.data.weight;
    }
    
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
  const { data, outsideRegion, fontFamily, sizeOptimization, colorPalette } = event.data;

  console.log("Worker received data:", {
    dataLength: data?.length,
    outsideRegionLength: outsideRegion?.length,
    fontFamily,
    sizeOptimization,
    colorPalette,
  });

  try {
    const glpk = await GLPK();
    const result = await layoutNonConvexVoronoiTreemap({
      data,
      outsideRegion,
      fontFamily,
      sizeOptimization,
      colorPalette,
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
