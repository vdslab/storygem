import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";
import GLPK from "glpk.js";
import { makeLpObject } from "../lp";
import { useEffect, useState } from "react";

//単語の凸包を求める関数
const getConvexHull = (word, fontName, fontSize) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px ${fontName}`;
  // 単語を描画するのに十分なサイズを設定する
  canvas.width = 100;
  canvas.height = 100;
  ctx.textAlign = "center";
  ctx.font = `${fontSize}px ${fontName}`;
  ctx.fillText(word, canvas.width / 2, canvas.height / 2);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const points = [];
  for (let i = 0; i < canvas.height; ++i) {
    for (let j = 0; j < canvas.width; ++j) {
      if (image.data[4 * (canvas.width * i + j) + 3] > 0) {
        const x = j - canvas.width / 2;
        const y = i - canvas.height / 2;
        points.push([x, y]);
        points.push([x + 1, y]);
        points.push([x, y + 1]);
        points.push([x + 1, y + 1]);
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
};

//getConvexHullで得た単語の凸包を多角形の頂点の座標に変換する関数
const convert2DArrayTo1DArray = (array2D) => {
  const arrayX = [];
  const arrayY = [];
  for (let i = 0; i < array2D.length; i++) {
    arrayX.push(array2D[i][0]);
    arrayY.push(array2D[i][1]);
  }
  return [arrayX, arrayY];
};

//多角形の座標を時計回りにソートする関数
const sortVerticesClockwise = (vertice) => {
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
};

//2点間の角度を求める関数
const getAngle = (p1, p2) => {
  const deltaX = p2[0] - p1[0];
  const deltaY = p2[1] - p1[1];
  return Math.atan2(deltaY, deltaX);
};

//LP解から拡大倍率とx,y軸方向に並行移動する値を求める関数
const calcResizeValue = (data, px, py, qx, qy) => {
  const vars = data.vars;
  let resizeX = [0, 0],
    resizeY = [0, 0];
  for (let i = 0; i < px.length; i++) {
    const lambdaName1 = `lambda1${i + 1}`;
    const lambdaName2 = `lambda2${i + 1}`;
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
};

const rotate = (q, theta) => {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return q.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
};

const textTransform = async (text, fontSize, fontName, polygon, glpk) => {
  let s = 0;
  let dx = 0;
  let dy = 0;
  let a = 0;
  let textPolygon = null;

  const [px, py] = convert2DArrayTo1DArray(sortVerticesClockwise(polygon));
  const radianList = [
    -Math.PI / 2,
    -Math.PI / 3,
    -Math.PI / 6,
    0,
    Math.PI / 6,
    Math.PI / 3,
    Math.PI / 2,
  ];
  for (let radian of radianList) {
    const [qx, qy] = convert2DArrayTo1DArray(
      sortVerticesClockwise(
        rotate(getConvexHull(text, fontName, fontSize), radian),
      ),
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
    const [stateS, statedx, statedy] = calcResizeValue(result, px, py, qx, qy);
    if (stateS > s) {
      s = stateS;
      dx = statedx;
      dy = statedy;
      a = radian * (180 / Math.PI);
      textPolygon = [];
      for (let j = 0; j < qx.length; j++) {
        let x = 0;
        let y = 0;
        for (let i = 0; i < px.length; i++) {
          const lambdaName1 = `lambda${j + 1}${i + 1}`;
          x += result.vars[lambdaName1] * px[i];
          y += result.vars[lambdaName1] * py[i];
        }
        textPolygon.push([x, y]);
      }
    }
  }

  return { s, dx, dy, a, polygon: textPolygon };
};

const RenderingText = ({ node, color }) => {
  const { s, dx, dy, a } = node.textTransform;
  return (
    <g key={node.id}>
      <text
        textAnchor="middle"
        fontSize={node.fontSize}
        fontFamily={node.fontFamily}
        fill={color}
        transform={`translate(${dx},${dy})scale(${s})rotate(${a})`}
      >
        {node.data.word}
      </text>
    </g>
  );
};

const layoutVoronoiTreeMap = async ({ data, chartSize, glpk }) => {
  const weightScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.weight))
    .range([1, 30]);
  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  root.sum((d) => weightScale(d.weight));

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
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

  const chartR = chartSize / 2;
  const yScale = 1;
  const numberOfSides = 8;
  const dt = (2 * Math.PI) / numberOfSides;
  const ellipse = d3
    .range(numberOfSides)
    .map((item) => [
      chartR * Math.cos(item * dt),
      yScale * chartR * Math.sin(item * dt),
    ]);

  const prng = d3.randomLcg(0);
  const _voronoiTreemap = voronoiTreemap()
    .clip(ellipse)
    .convergenceRatio(0.001)
    .maxIterationCount(50)
    .minWeightRatio(0.01)
    .prng(prng);
  _voronoiTreemap(root);
  for (const node of root.descendants()) {
    if (node.polygon.site) {
      node.polygon.site.y /= yScale;
    }
    for (const item of node.polygon) {
      item[1] /= yScale;
    }
  }

  const allNodes = root.descendants().sort((a, b) => b.depth - a.depth);

  const fontSize = 10;
  const fontFamily = "serif";
  for (const node of allNodes) {
    node.fontSize = fontSize;
    node.fontFamily = fontFamily;
    if (node.data.word) {
      node.textTransform = await textTransform(
        node.data.word,
        fontSize,
        fontFamily,
        node.polygon,
        glpk,
      );
    }
  }

  return allNodes;
};

const VoronoiTreeMap = ({ data }) => {
  const [cells, setCells] = useState(null);
  const chartSize = 1000;
  const margin = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  };
  const fontColor = "#444";
  const showTextPolygon = false;

  useEffect(() => {
    (async () => {
      const glpk = await GLPK();
      const cells = await layoutVoronoiTreeMap({ data, chartSize, glpk });
      setCells(cells);
    })();
  }, [data, chartSize]);

  if (cells == null) {
    return null;
  }

  return (
    <div className="container">
      <section className="section">
        <figure className="image is-square">
          <svg
            className="has-ratio"
            viewBox={`0 0 ${chartSize + margin.left + margin.right} ${
              chartSize + margin.top + margin.bottom
            }`}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              <g transform={`translate(${chartSize / 2},${chartSize / 2})`}>
                <g>
                  {cells.map((node) => {
                    return (
                      <g key={node.id}>
                        <path
                          d={"M" + node.polygon.join("L") + "Z"}
                          fill={node.color}
                          stroke={fontColor}
                          strokeWidth={node.height + 1}
                        />
                      </g>
                    );
                  })}
                </g>
                {showTextPolygon && (
                  <g>
                    {cells
                      .filter((node) => node.data.word)
                      .map((node) => {
                        return (
                          <g key={node.id}>
                            <path
                              d={
                                "M" + node.textTransform.polygon.join("L") + "Z"
                              }
                              fill="#888"
                              opacity="0.5"
                              stroke={fontColor}
                              strokeWidth={node.height + 1}
                            />
                          </g>
                        );
                      })}
                  </g>
                )}
                <g>
                  {cells
                    .filter((node) => node.data.word)
                    .map((node) => {
                      return (
                        <RenderingText
                          key={node.id}
                          node={node}
                          color={fontColor}
                        />
                      );
                    })}
                </g>
              </g>
            </g>
          </svg>
        </figure>
      </section>
    </div>
  );
};

export default VoronoiTreeMap;
