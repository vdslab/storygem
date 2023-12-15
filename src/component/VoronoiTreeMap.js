import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";
import GLPK from "glpk.js";
import { useEffect, useState } from "react";

//単語の凸包を求める関数
const getConvexHull = (word, fontName, fontSize) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `bold ${fontSize}px '${fontName}'`;
  canvas.width = ctx.measureText(word).width;
  canvas.height = fontSize;
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSize}px '${fontName}'`;
  ctx.fillText(word, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const points = [];
  for (let i = 0; i < canvas.height; ++i) {
    for (let j = 0; j < canvas.width; ++j) {
      if (image.data[4 * (canvas.width * i + j) + 3] > 0) {
        points.push([j, i]);
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

  while (vertices.length > 0) {
    let closestIndex = 0;
    let closestAngle = getAngle(
      sortedVertices[sortedVertices.length - 1],
      vertices[0]
    );
    for (let i = 1; i < vertices.length; i++) {
      const angle = getAngle(
        sortedVertices[sortedVertices.length - 1],
        vertices[i]
      );
      if (angle < closestAngle) {
        closestIndex = i;
        closestAngle = angle;
      }
    }
    sortedVertices.push(vertices[closestIndex]);
    vertices.splice(closestIndex, 1);
  }

  return sortedVertices;
};

//2点間の角度を求める関数
const getAngle = (p1, p2) => {
  const deltaX = p2[0] - p1[0];
  const deltaY = p2[1] - p1[1];
  return Math.atan2(deltaY, deltaX);
};

//目的関数のオブジェクトを作成する関数(makeLpObject)で呼び出す
const createObjective = (outSidesPoints) => {
  const objective = {
    direction: 2,
    name: "obj",
    vars: [],
  };

  for (let i = 1; i <= 2; i++) {
    for (let j = 0; j < outSidesPoints.length; j++) {
      const coef = i === 1 ? -outSidesPoints[j] : outSidesPoints[j];
      const name = `lambda${i}${j + 1}`;
      objective.vars.push({ name: name, coef: coef });
    }
  }

  return objective;
};

const initlambdaCoefDict = (lambdaNames) => {
  const lambdaCoefDict = {};
  for (let lambdaIName of lambdaNames) {
    for (let lambdaName of lambdaIName) {
      lambdaCoefDict[lambdaName] = 0;
    }
  }
  return lambdaCoefDict;
};

//LPソルバーに入れるオブジェクトを作成する関数
const makeLpObject = (
  outsidesXPoints,
  outsidesYPoints,
  insidesXpoints,
  insidesYpoints
) => {
  const outSides = outsidesXPoints.length;
  const inSides = insidesXpoints.length;
  const objective = createObjective(outsidesXPoints);

  //lambdaの名前を保持する配列の作成
  const lambdaNames = Array(inSides);
  for (let i = 0; i < inSides; i++) {
    lambdaNames[i] = Array(outSides);
    for (let j = 0; j < outSides; j++) {
      lambdaNames[i][j] = `lambda${i + 1}${j + 1}`;
    }
  }

  //最適化後の多角形の各頂点が凸包の内側にある制約
  const subjectTo = [];
  let consCount = 1;
  for (let lambdaINames of lambdaNames) {
    const inConvexObj = {
      name: `c${consCount}`,
      vars: [],
      bnds: { type: 5, ub: 1.0, lb: 1.0 },
    };

    for (let lambdaName of lambdaINames) {
      inConvexObj.vars.push({ name: lambdaName, coef: 1.0 });
      //lambdaの非負制約
      consCount += 1;
      const nonNegObj = {
        name: `c${consCount}`,
        vars: [{ name: lambdaName, coef: 1.0 }],
        bnds: { type: 3, ub: 1.0, lb: 0.0 },
      };
      subjectTo.push(nonNegObj);
    }
    subjectTo.push(inConvexObj);
    consCount += 1;
  }

  for (let i = 0; i < inSides; i++) {
    const affinObj = {
      name: `c${consCount}`,
      vars: [],
      bnds: { type: 5, ub: 0.0, lb: 0.0 },
    };
    const diff1st2ndX = insidesXpoints[1] - insidesXpoints[0];
    const diff2ndIX = insidesXpoints[1] - insidesXpoints[i];
    const diff1stIX = insidesXpoints[0] - insidesXpoints[i];
    const diff1stIY = insidesYpoints[0] - insidesYpoints[i];
    for (let j = 0; j < outSides; j++) {
      const lambdaCoefsX = initlambdaCoefDict(lambdaNames);
      const lambdaCoefsY = initlambdaCoefDict(lambdaNames);
      //xについての制約
      lambdaCoefsX[`lambda${i + 1}${j + 1}`] = diff1st2ndX * outsidesXPoints[j];
      lambdaCoefsX[`lambda1${j + 1}`] = -diff2ndIX * outsidesXPoints[j];
      lambdaCoefsX[`lambda2${j + 1}`] = diff1stIX * outsidesXPoints[j];
      //yについての制約
      lambdaCoefsY[`lambda${i + 1}${j + 1}`] = diff1st2ndX * outsidesYPoints[j];
      lambdaCoefsY[`lambda1${j + 1}`] = -diff1st2ndX * outsidesYPoints[j];
      lambdaCoefsY[`lambda2${j + 1}`] = diff1stIY * outsidesXPoints[j];
      lambdaCoefsY[`lambda1${j + 1}`] = -diff1stIY * outsidesXPoints[j];
    }
  }

  return [objective, subjectTo];
};
//(inside_x_points[1]-inside_x_points[0])*pulp.lpDot( outside_y_points, lambda_dict[lambda_name] ) - (inside_x_points[1]-inside_x_points[0])*pulp.lpDot( outside_y_points, lambda_dict["lambda1"] )+ (inside_y_points[0] - inside_y_points[i])*pulp.lpDot( outside_x_points, lambda_dict["lambda2"] ) + (inside_y_points[i] - inside_y_points[0])*pulp.lpDot( outside_x_points, lambda_dict["lambda1"] )
//(inside_x_points[1]-inside_x_points[0])*pulp.lpDot( outside_x_points, lambda_dict[lambda_name] ) - (inside_x_points[1] - inside_x_points[i])*pulp.lpDot( outside_x_points, lambda_dict["lambda1"] ) + (inside_x_points[0] - inside_x_points[i])*pulp.lpDot( outside_x_points, lambda_dict["lambda2"] )

//LP解から拡大倍率とx,y軸方向に並行移動する値を求める関数
const calcResizeValue = (data, px, py, qx, qy) => {
  const vars = data.vars;
  let resizeX = [0, 0],
    resizeY = [0, 0];
  for (let i = 0; i < px.length; i++) {
    const lambdaName1 = "lambda1" + String(i);
    const lambdaName2 = "lambda2" + String(i);
    resizeX[0] += vars[lambdaName1] * px[i];
    resizeX[1] += vars[lambdaName2] * px[i];
    resizeY[0] += vars[lambdaName1] * py[i];
    resizeY[1] += vars[lambdaName2] * py[i];
  }
  const S =
    Math.hypot(qx[1] - qx[0], qy[1] - qy[0]) /
    Math.hypot(resizeX[1] - resizeX[0], resizeY[1] - resizeY[0]);
  const dx = qx[0] - S * resizeX[0];
  const dy = qy[0] - S * resizeY[0];
  return [1 / S, -dx, -dy];
};

const RenderingText = ({ node, fontSize, fontName, color }) => {
  const [S, setS] = useState(0);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    const [qx, qy] = convert2DArrayTo1DArray(
      sortVerticesClockwise(getConvexHull(node.data.word, fontName, fontSize))
    );
    const [px, py] = convert2DArrayTo1DArray(
      sortVerticesClockwise(node.polygon)
    );
    console.log(node.data.word, px, py, qx, qy);
    const [objective, subjectTo] = makeLpObject(px, py, qx, qy);
    const solveLp = async () => {
      const glpk = await GLPK();
      const options = {
        msglev: glpk.GLP_MSG_ALL,
        presol: true,
      };
      const res = glpk.solve(
        {
          name: "LP",
          objective: objective,
          subjectTo: subjectTo,
        },
        options
      );
      return res;
    };
    let result;
    solveLp(objective, subjectTo).then(
      (data) => {
        result = data.result;
        //console.log(result);
        const [stateS, statedx, statedy] = calcResizeValue(
          result,
          p_x,
          p_y,
          q_x,
          q_y
        );
        setS(stateS);
        setDx(statedx);
        setDy(statedy);
        console.log(node.data.word, " is success", stateS, statedx, statedy);
      },
      (err) => {
        console.log("error");
        result = null;
      }
    );
  }, []);
  return (
    <g key={node.id}>
      <text
        textAnchor="start"
        dominantBaseline="hanging"
        fontSize={fontSize}
        fontFamily={fontName}
        fontWeight="bold"
        fill={color}
        transform={`scale(${S})translate(${dx},${dy})`}
      >
        {node.data.word}
      </text>
    </g>
  );
};

const VoronoiTreeMap = ({ data }) => {
  const weightScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.weight))
    .range([1, 30]);
  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  root.sum((d) => weightScale(d.weight));

  const chartSize = 1000;
  const margin = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  };

  const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
  const nodeColor = {};
  nodeColor[root.id] = "none";
  for (const cluster of root.children) {
    const color = colorScale(cluster.id);
    for (const node of cluster.descendants()) {
      if (node.children) {
        nodeColor[node.id] = "none";
      } else {
        nodeColor[node.id] = color;
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

  const color = "#444";
  const fontSize = 10;
  const fontFamily = "New Tegomin";

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
              <g transform={`translate(${chartR},${chartR})`}>
                <g>
                  {allNodes.map((node) => {
                    return (
                      <g key={node.id}>
                        <path
                          d={"M" + node.polygon.join("L") + "Z"}
                          fill={nodeColor[node.data.id]}
                          stroke={color}
                          strokeWidth={node.height + 1}
                        />
                      </g>
                    );
                  })}
                </g>
                <g>
                  {allNodes
                    .filter((node) => node.data.word)
                    .map((node) => {
                      return (
                        <RenderingText
                          node={node}
                          fontSize={fontSize}
                          fontName={fontFamily}
                          color={color}
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
