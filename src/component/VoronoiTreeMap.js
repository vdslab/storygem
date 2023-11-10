import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";
import Simplex from "simplex-solver"

function getConvexHull(word) {
  const fontSize = 48;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSize}px serif`;
  canvas.width = ctx.measureText(word).width;
  canvas.height = fontSize;
  ctx.textBaseline = "top";
  ctx.font = `bold ${fontSize}px serif`;
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
}

const resultx = Simplex.maximize(
  '-84.71806249273098lambda10 -76.3102293785846lambda11 -223.3695684469413lambda12 -328.77480252306344lambda13 -248.8355904076537lambda14 + 84.71806249273098lambda20 + 76.3102293785846lambda21 + 223.3695684469413lambda22 + 328.77480252306344lambda23 + 248.8355904076537lambda24', 
[
  'lambda10 + lambda11 + lambda12 + lambda13 + lambda14 = 1',
  'lambda20 + lambda21 + lambda22 + lambda23 + lambda24 = 1',
  'lambda30 + lambda31 + lambda32 + lambda33 + lambda34 = 1',
  'lambda40 + lambda41 + lambda42 + lambda43 + lambda44 = 1',
  '5034.31803477lambda10 + 4534.68779495lambda11 + 13273.5973152lambda12 + 19537.2376211lambda13 + 14786.89979lambda14 -9097.57830641lambda20 -8194.69032842lambda21 -23986.8816687lambda22 -35305.9834363lambda23 -26721.5892638lambda24 + 4063.26027164lambda30 + 3660.00253347lambda31 + 10713.2843535lambda32 + 15768.7458152lambda33 + 11934.6894738lambda34 = 0',
  '-212.760884798lambda10 -191.645458407lambda11 -560.970182998lambda12 -825.684816508lambda13 -624.925533312lambda14 -3850.49938684lambda20 -3468.35707506lambda21 -10152.3141705lambda22 -14943.0609987lambda23 -11309.7639405lambda24 + 4063.26027164lambda40 + 3660.00253347lambda41 + 10713.2843535lambda42 + 15768.7458152lambda43 + 11934.6894738lambda44 = 0',
  '-17440.8903556lambda10 -8798.42139668lambda11 -14534.9807751lambda12 -24341.0165313lambda13 -27642.7444192lambda14 + 17440.8903556lambda20 + 8798.42139668lambda21 + 14534.9807751lambda22 + 24341.0165313lambda23 + 27642.7444192lambda24 = 0',
  '-13455.7637481lambda10 -5208.79816204lambda11 -4027.70541586lambda12 -8875.49271209lambda13 -15937.5507091lambda14 + 31.7300501279lambda20 + 28.5810054221lambda21 + 83.6601711055lambda22 + 123.138332699lambda23 + 93.1981389201lambda24 + 13424.033698lambda30 + 5180.21715662lambda31 + 3944.04524475lambda32 + 8752.35437939lambda33 + 15844.3525702lambda34 = 0',
  '-9008.26247929lambda10 -1202.68857928lambda11 + 7698.67748114lambda12 + 8384.41985379lambda13 -2874.26088049lambda14 -4415.77121868lambda20 -3977.52857733lambda21 -11642.7227259lambda22 -17136.7742332lambda23 -12970.0916897lambda24 + 13424.033698lambda40 + 5180.21715662lambda41 + 3944.04524475lambda42 + 8752.35437939lambda43 + 15844.3525702lambda44 = 0',
  'lambda10 >= 0',
  'lambda11 >= 0',
  'lambda12 >= 0',
  'lambda13 >= 0',
  'lambda14 >= 0',
  'lambda20 >= 0',
  'lambda21 >= 0',
  'lambda22 >= 0',
  'lambda23 >= 0',
  'lambda24 >= 0',
  'lambda30 >= 0',
  'lambda31 >= 0',
  'lambda32 >= 0',
  'lambda33 >= 0',
  'lambda34 >= 0',
  'lambda40 >= 0',
  'lambda41 >= 0',
  'lambda42 >= 0',
  'lambda43 >= 0',
  'lambda44 >= 0',
  'lambda10 <= 1',
  'lambda11 <= 1',
  'lambda12 <= 1',
  'lambda13 <= 1',
  'lambda14 <= 1',
  'lambda20 <= 1',
  'lambda21 <= 1',
  'lambda22 <= 1',
  'lambda23 <= 1',
  'lambda24 <= 1',
  'lambda30 <= 1',
  'lambda31 <= 1',
  'lambda32 <= 1',
  'lambda33 <= 1',
  'lambda34 <= 1',
  'lambda40 <= 1',
  'lambda41 <= 1',
  'lambda42 <= 1',
  'lambda43 <= 1',
  'lambda44 <= 1'
]);

console.log(resultx);

function simplexMethod(c, A, b) {
    const C = c.concat();
    const m = A.length;
    const n = A[0].length;

    // スラック変数を導入して標準形に変換
    for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
            if (i === j) {
                A[i].push(1);
            } else {
                A[i].push(0);
            }
        }
    }

    const basis = [];
    for (let i = 0; i < m; i++) {
        basis[i] = n + i;
    }

    // 目的関数にスラック変数の係数を追加
    for (let i = 0; i < m; i++) {
        c.push(0);
    }

    while (true) {
        // 目的関数の最大値を探す
        const entering = c.findIndex((value, index) => index < n && value > 0);

        if (entering === -1) {
            break; // 最適解に達した
        }

        const minRatios = [];
        for (let i = 0; i < m; i++) {
            if (A[i][entering] > 0) {
                minRatios.push(b[i] / A[i][entering]);
            } else {
                minRatios.push(Infinity);
            }
        }

        const leaving = minRatios.indexOf(Math.min(...minRatios));

        // 主変数を更新
        basis[leaving] = entering;

        const pivot = A[leaving][entering];
        for (let j = 0; j < n + m; j++) {
            A[leaving][j] /= pivot;
        }
        b[leaving] /= pivot;

        for (let i = 0; i < m; i++) {
            if (i !== leaving) {
                const factor = A[i][entering];
                for (let j = 0; j < n + m; j++) {
                    A[i][j] -= factor * A[leaving][j];
                }
                b[i] -= factor * b[leaving];
            }
        }

        const factor = c[entering];
        for (let j = 0; j < n + m; j++) {
            c[j] -= factor * A[leaving][j];
        }
    }

    const solution = new Array(n).fill(0);
    for (let i = 0; i < m; i++) {
        if (basis[i] < n) {
            solution[basis[i]] = b[i];
        }
    }

    const optimalValue = C.slice(-m).reduce((acc, val, i) => acc + val * solution[i], 0);

    return { optimalValue, solution };
}

// テストケース
//pは周りの多角形の座標
const p_x = [84.71806249273098, 76.3102293785846, 223.3695684469413,328.77480252306344, 248.8355904076537];
const p_y = [279.8880824020763, 108.00636224645602, 82.23245600370788, 182.48461966538346, 330.351186353769];

//qは内側の多角形の座標
const q_x = [145.99568420051924, 193.95783243765567, 253.38220885322718, 191.44643311455903];
const q_y = [200.23112133304835, 152.81671477805406,199.8565843194025, 252.35425881702227, ];

const c1 = []//目的関数の係数
const varNum = p_x.length*q_x.length;
for (let i = 0; i < varNum; i++){
  if(i < p_x.length){
    c1[i] = -p_x[i];
  } else if(i < p_x.length*2){
    c1[i] = p_x[i-p_x.length];
  } else {
    c1[i] = 0;
  }
}

const testA_ineq = [
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1],
  [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [5034.31803477, 4534.68779495, 13273.5973152, 19537.2376211, 14786.89979, -9097.57830641, -8194.69032842, -23986.8816687, -35305.9834363, -26721.5892638, 4063.26027164, 3660.00253347, 10713.2843535, 15768.7458152, 11934.6894738, 0, 0, 0, 0, 0 ],
  [-212.760884798, -191.645458407, -560.970182998, -825.684816508, -624.925533312, -3850.49938684, -3468.35707506, -10152.3141705, -14943.0609987, -11309.7639405, 0, 0, 0, 0, 0, 4063.26027164, 3660.00253347, 10713.2843535, 15768.7458152, 11934.6894738 ],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [-17440.8903556, -8798.42139668, -14534.9807751, -24341.0165313, -27642.7444192, 17440.8903556, 8798.42139668, 14534.9807751, 24341.0165313, 27642.7444192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
  [-13455.7637481, -5208.79816204, -4027.70541586, -8875.49271209, -15937.5507091, 31.7300501279, 28.5810054221, 83.6601711055, 123.138332699, 93.1981389201, 13424.033698, 5180.21715662, 3944.04524475, 8752.35437939, 15844.3525702, 0, 0, 0, 0, 0 ],
  [-9008.26247929, -1202.68857928, 7698.67748114, 8384.41985379, -2874.26088049, -4415.77121868, -3977.52857733, -11642.7227259, -17136.7742332, -12970.0916897, 0, 0, 0, 0, 0, 13424.033698, 5180.21715662, 3944.04524475, 8752.35437939, 15844.3525702 ],
  [-5034.31803477, -4534.68779495, -13273.5973152, -19537.2376211, -14786.89979, 9097.57830641, 8194.69032842, 23986.8816687, 35305.9834363, 26721.5892638, 4063.26027164, 3660.00253347, 10713.2843535, 15768.7458152, 11934.6894738, 0, 0, 0, 0, 0 ],
  [212.760884798, 191.645458407, 560.970182998, 825.684816508, 624.925533312, 3850.49938684, 3468.35707506, 10152.3141705, 14943.0609987, 11309.7639405, 0, 0, 0, 0, 0, -4063.26027164, -3660.00253347, -10713.2843535, -15768.7458152, -11934.6894738 ],
  [17440.8903556, 8798.42139668, 14534.9807751, 24341.0165313, 27642.7444192, -17440.8903556, -8798.42139668, -14534.9807751, -24341.0165313, -27642.7444192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
  [13455.7637481, 5208.79816204, 4027.70541586, 8875.49271209, 15937.5507091, -31.7300501279, -28.5810054221, -83.6601711055, -123.138332699, -93.1981389201, -13424.033698, -5180.21715662, -3944.04524475, -8752.35437939, -15844.3525702, 0, 0, 0, 0, 0 ],
  [9008.26247929, 1202.68857928, -7698.67748114, -8384.41985379, 2874.26088049, 4415.77121868, 3977.52857733, 11642.7227259, 17136.7742332, 12970.0916897, 0, 0, 0, 0, 0, -13424.033698, -5180.21715662, -3944.04524475, -8752.35437939, -15844.3525702 ]
];

const testb_ineq = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0];

//const test_result = simplexMethod(c1, testA_ineq, testb_ineq);
const test_result = simplexMethod([-4,4],[[4,-1],[2,2],[3,-1],[-3,1],[-1,0],[0,-1]],[15,40,8,-8,0,0]);
console.log("Test Optimal Value:", test_result.optimalValue,test_result.solution);

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
      //console.log(node.data.word,node.polygon);
    }
    for (const item of node.polygon) {
      item[1] /= yScale;
    }
  }

  const allNodes = root.descendants().sort((a, b) => b.depth - a.depth);

  const color = "#444";
  const fontSize = 10;
  const fontFamily = "New Tegomin";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `bold ${fontSize}px '${fontFamily}'`;

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
                      const [cx, cy] = d3.polygonCentroid(node.polygon);
                      const measure = context.measureText(node.data.word);
                      const r0 = Math.hypot(measure.width / 2, fontSize / 2);
                      let r = Infinity;
                      for (let i = 0; i < node.polygon.length; ++i) {
                        const [x1, y1] = node.polygon[i];
                        const [x2, y2] =
                          node.polygon[(i + 1) % node.polygon.length];
                        const a = y2 - y1;
                        const b = x1 - x2;
                        const c = -(a * x1 + b * y1);
                        r = Math.min(
                          r,
                          Math.abs(a * cx + b * cy + c) / Math.hypot(a, b) - 2,
                        );
                      }

                      let q = getConvexHull(node.data.word);
                      console.log(node.data.word,q);

                      return (
                        <g key={node.id}>
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={fontSize}
                            fontFamily={fontFamily}
                            fontWeight="bold"
                            fill={color}
                            transform={`translate(${cx},${cy})rotate(0)scale(${
                              (r / r0)*1.1
                            })`}
                          >
                            {node.data.word}
                          </text>
                        </g>
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
