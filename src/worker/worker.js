import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";
import GLPK from "glpk.js";
import { makeLpObject } from "./lp";
import { fontSize } from "../fonts";

//単語の凸包を求める関数
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

//getConvexHullで得た単語の凸包を多角形の頂点の座標に変換する関数
function convert2DArrayTo1DArray(array2D) {
  const arrayX = [];
  const arrayY = [];
  for (let i = 0; i < array2D.length; i++) {
    arrayX.push(array2D[i][0]);
    arrayY.push(array2D[i][1]);
  }
  return [arrayX, arrayY];
}

//多角形の座標を時計回りにソートする関数
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

//2点間の角度を求める関数
function getAngle(p1, p2) {
  const deltaX = p2[0] - p1[0];
  const deltaY = p2[1] - p1[1];
  return Math.atan2(deltaY, deltaX);
}

//LP解から拡大倍率とx,y軸方向に並行移動する値を求める関数
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

async function textTransform(node, sizeOptimization, glpk) {
  const { polygon } = node;
  if (sizeOptimization) {
    const { rotateStep } = sizeOptimization;
    let s = 0;
    let dx = 0;
    let dy = 0;
    let a = 0;
    let resultText = null;
    let textPolygon = null;

    const [px, py] = convert2DArrayTo1DArray(sortVerticesClockwise(polygon));
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
        if (stateS > s) {
          s = stateS;
          dx = statedx;
          dy = statedy;
          a = radian * (180 / Math.PI);
          resultText = lines;
          textPolygon = [];
          for (let j = 0; j < qx.length; j++) {
            let x = 0;
            let y = 0;
            for (let i = 0; i < px.length; i++) {
              const lambdaName1 = `lambda${j + 1}_${i + 1}`;
              x += result.vars[lambdaName1] * px[i];
              y += result.vars[lambdaName1] * py[i];
            }
            textPolygon.push([x, y]);
          }
        }
      }
    }

    return { s, dx, dy, a, polygon: textPolygon, lines: resultText };
  } else {
    const [cx, cy] = d3.polygonCentroid(polygon);
    const measure = node.data.textMeasure;
    const r0 = Math.hypot(measure.width / 2, fontSize / 2);
    let r = Infinity;
    for (let i = 0; i < polygon.length; ++i) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      const a = y2 - y1;
      const b = x1 - x2;
      const c = -(a * x1 + b * y1);
      r = Math.min(r, Math.abs(a * cx + b * cy + c) / Math.hypot(a, b) - 2);
    }
    const s = r / r0;
    return {
      s,
      dx: cx - s * (measure.width / 2),
      dy: cy - s * (fontSize / 2 - measure.actualBoundingBoxAscent),
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

async function layoutVoronoiTreeMap({
  data,
  outsideRegion,
  fontFamily,
  sizeOptimization,
  colorPalette,
  glpk,
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
  root.color = "none";
  for (const cluster of root.children) {
    const color = colorScale(cluster.id);
    for (const node of cluster.descendants()) {
      if (node.children) {
        node.color = "none";
      } else {
        node.color = color;
      }
    }
  }

  const prng = d3.randomLcg(0);
  const _voronoiTreemap = voronoiTreemap()
    .clip(outsideRegion)
    .convergenceRatio(0.001)
    .maxIterationCount(50)
    .minWeightRatio(0.01)
    .prng(prng);
  _voronoiTreemap(root);

  const allNodes = root.descendants().sort((a, b) => b.depth - a.depth);

  for (const node of allNodes) {
    node.fontFamily = fontFamily;
    if (node.data.word) {
      node.textTransform = await textTransform(node, sizeOptimization, glpk);
    }
  }

  return allNodes;
}

onmessage = async (event) => {
  const { data, outsideRegion, fontFamily, sizeOptimization, colorPalette } =
    event.data;
  const glpk = await GLPK();
  const cells = await layoutVoronoiTreeMap({
    data,
    outsideRegion,
    fontFamily,
    sizeOptimization,
    colorPalette,
    glpk,
  });
  postMessage(cells);
};
