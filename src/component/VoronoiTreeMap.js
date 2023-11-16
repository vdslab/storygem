import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";
import GLPK from "glpk.js";

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

function simplexMethod(c, A, b) {
  const C = c.concat(); // 元の目的関数を保持
  const m = A.length; // 制約条件の本数
  const n = A[0].length; // 変数の数

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

  const basis = []; // 基底
  for (let i = 0; i < m; i++) {
    basis[i] = n + i; // 最初の基底解をスラック変数にする
  }

  for (let i = 0; i < m; i++) {
    c.push(0); // 目的関数にスラック変数の係数を追加
  }

  while (true) {
    // 目的関数の最大値を探す
    const entering = c.findIndex((value, index) => index < n && value > 0);

    if (entering === -1) {
      break;
    }

    const minRatios = []; //最小比率
    for (let i = 0; i < m; i++) {
      if (A[i][entering] > 0) {
        // 入れ替えられそうなら入れ替える
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

  const optimalValue = C.slice(-m).reduce(
    (acc, val, i) => acc + val * solution[i],
    0
  );

  return { optimalValue, solution };
}

async function glpktest() {
  const glpk = await GLPK();
  const options = {
    msglev: glpk.GLP_MSG_ALL,
    presol: true,
  };
  const res = glpk.solve(
    {
      name: "LP",
      objective: {
        direction: glpk.GLP_MAX,
        name: "obj",
        vars: [
          { name: "x1", coef: 3 },
          { name: "x2", coef: 2 },
        ],
      },
      subjectTo: [
        {
          name: "cons1",
          vars: [
            { name: "x1", coef: 2.0 },
            { name: "x2", coef: 2.0 },
          ],
          bnds: { type: glpk.GLP_UP, ub: 4.0, lb: 0.0 },
        },
        {
          name: "cons2",
          vars: [
            { name: "x1", coef: 2.0 },
            { name: "x2", coef: 1.0 },
          ],
          bnds: { type: glpk.GLP_UP, ub: 10.0, lb: 0.0 },
        },
        {
          name: "cons2",
          vars: [
            { name: "x1", coef: 1.0 },
            { name: "x2", coef: 2.0 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 4.0, lb: 4.0 },
        },
      ],
    },
    options
  );
  return res;
}

//LPを解くときに呼び出す関数
async function solveLp(obj) {
  const glpk = await GLPK();

  const options = {
    msglev: glpk.GLP_MSG_ALL,
    presol: true,
  };
  const res = glpk.solve(
    {
      name: "LP",
      objective: obj,
      subjectTo: [
        {
          name: "c1",
          vars: [
            { name: "lambda10", coef: 1.0 },
            { name: "lambda11", coef: 1.0 },
            { name: "lambda12", coef: 1.0 },
            { name: "lambda13", coef: 1.0 },
            { name: "lambda14", coef: 1.0 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 },
        },
        {
          name: "c2",
          vars: [
            { name: "lambda20", coef: 1.0 },
            { name: "lambda21", coef: 1.0 },
            { name: "lambda22", coef: 1.0 },
            { name: "lambda23", coef: 1.0 },
            { name: "lambda24", coef: 1.0 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 },
        },
        {
          name: "c3",
          vars: [
            { name: "lambda30", coef: 1.0 },
            { name: "lambda31", coef: 1.0 },
            { name: "lambda32", coef: 1.0 },
            { name: "lambda33", coef: 1.0 },
            { name: "lambda34", coef: 1.0 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 },
        },
        {
          name: "c4",
          vars: [
            { name: "lambda40", coef: 1.0 },
            { name: "lambda41", coef: 1.0 },
            { name: "lambda42", coef: 1.0 },
            { name: "lambda43", coef: 1.0 },
            { name: "lambda44", coef: 1.0 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 },
        },
        {
          name: "c5",
          vars: [
            { name: "lambda10", coef: 5034.31803477 },
            { name: "lambda11", coef: 4534.68779495 },
            { name: "lambda12", coef: 13273.5973152 },
            { name: "lambda13", coef: 19537.2376211 },
            { name: "lambda14", coef: 14786.89979 },
            { name: "lambda20", coef: -9097.57830641 },
            { name: "lambda21", coef: -8194.69032842 },
            { name: "lambda22", coef: -23986.8816687 },
            { name: "lambda23", coef: -35305.9834363 },
            { name: "lambda24", coef: -26721.5892638 },
            { name: "lambda30", coef: 4063.26027164 },
            { name: "lambda31", coef: 3660.00253347 },
            { name: "lambda32", coef: 10713.2843535 },
            { name: "lambda33", coef: 15768.7458152 },
            { name: "lambda34", coef: 11934.6894738 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 },
        },
        {
          name: "c6",
          vars: [
            { name: "lambda10", coef: -212.760884798 },
            { name: "lambda11", coef: -191.645458407 },
            { name: "lambda12", coef: -560.970182998 },
            { name: "lambda13", coef: -825.684816508 },
            { name: "lambda14", coef: -624.925533312 },
            { name: "lambda20", coef: -3850.49938684 },
            { name: "lambda21", coef: -3468.35707506 },
            { name: "lambda22", coef: -10152.3141705 },
            { name: "lambda23", coef: -14943.0609987 },
            { name: "lambda24", coef: -11309.7639405 },
            { name: "lambda40", coef: 4063.26027164 },
            { name: "lambda41", coef: 3660.00253347 },
            { name: "lambda42", coef: 10713.2843535 },
            { name: "lambda43", coef: 15768.7458152 },
            { name: "lambda44", coef: 11934.6894738 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 },
        },
        {
          name: "c7",
          vars: [
            { name: "lambda10", coef: -17440.8903556 },
            { name: "lambda11", coef: -8798.42139668 },
            { name: "lambda12", coef: -14534.9807751 },
            { name: "lambda13", coef: -24341.0165313 },
            { name: "lambda14", coef: -27642.7444192 },
            { name: "lambda20", coef: 17440.8903556 },
            { name: "lambda21", coef: 8798.42139668 },
            { name: "lambda22", coef: 14534.9807751 },
            { name: "lambda23", coef: 24341.0165313 },
            { name: "lambda24", coef: 27642.7444192 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 },
        },
        {
          name: "c8",
          vars: [
            { name: "lambda10", coef: -13455.7637481 },
            { name: "lambda11", coef: -5208.79816204 },
            { name: "lambda12", coef: -4027.70541586 },
            { name: "lambda13", coef: -8875.49271209 },
            { name: "lambda14", coef: -15937.5507091 },
            { name: "lambda20", coef: 31.7300501279 },
            { name: "lambda21", coef: 28.5810054221 },
            { name: "lambda22", coef: 83.6601711055 },
            { name: "lambda23", coef: 123.138332699 },
            { name: "lambda24", coef: 93.1981389201 },
            { name: "lambda30", coef: 13424.033698 },
            { name: "lambda31", coef: 5180.21715662 },
            { name: "lambda32", coef: 3944.04524475 },
            { name: "lambda33", coef: 8752.35437939 },
            { name: "lambda34", coef: 15844.3525702 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 },
        },
        {
          name: "c9",
          vars: [
            { name: "lambda10", coef: -9008.26247929 },
            { name: "lambda11", coef: -1202.68857928 },
            { name: "lambda12", coef: 7698.67748114 },
            { name: "lambda13", coef: 8384.41985379 },
            { name: "lambda14", coef: -2874.26088049 },
            { name: "lambda20", coef: -4415.77121868 },
            { name: "lambda21", coef: -3977.52857733 },
            { name: "lambda22", coef: -11642.7227259 },
            { name: "lambda23", coef: -17136.7742332 },
            { name: "lambda24", coef: -12970.0916897 },
            { name: "lambda40", coef: 13424.033698 },
            { name: "lambda41", coef: 5180.21715662 },
            { name: "lambda42", coef: 3944.04524475 },
            { name: "lambda43", coef: 8752.35437939 },
            { name: "lambda44", coef: 15844.3525702 },
          ],
          bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 },
        },
        {
          name: "c10",
          vars: [{ name: "lambda10", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c11",
          vars: [{ name: "lambda11", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c12",
          vars: [{ name: "lambda12", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c13",
          vars: [{ name: "lambda13", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c14",
          vars: [{ name: "lambda14", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c15",
          vars: [{ name: "lambda20", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c16",
          vars: [{ name: "lambda21", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c17",
          vars: [{ name: "lambda22", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c18",
          vars: [{ name: "lambda23", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c19",
          vars: [{ name: "lambda24", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c20",
          vars: [{ name: "lambda30", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c21",
          vars: [{ name: "lambda31", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c22",
          vars: [{ name: "lambda32", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c23",
          vars: [{ name: "lambda33", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c24",
          vars: [{ name: "lambda34", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c25",
          vars: [{ name: "lambda40", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c26",
          vars: [{ name: "lambda41", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c27",
          vars: [{ name: "lambda42", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c28",
          vars: [{ name: "lambda43", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
        {
          name: "c29",
          vars: [{ name: "lambda44", coef: 1.0 }],
          bnds: { type: glpk.GLP_UP, ub: 1.0, lb: 0.0 },
        },
      ],
    },
    options
  );
  return res;
}

//目的関数のオブジェクトを作成する関数(makeLpObject)で呼び出す
function createObjective(outSides, objectiveCoef) {
  const objective = {
    direction: 2,
    name: "obj",
    vars: [],
  };

  for (let i = 1; i <= 2; i++) {
    for (let j = 0; j < outSides; j++) {
      const coef = objectiveCoef.shift();
      const name = `lambda${i}${j}`;
      objective.vars.push({ name: name, coef: coef });
    }
  }

  return objective;
}

//LPソルバーに入れるオブジェクトを作成する関数
function makeLpObject(px, py, qx, qy) {
  const outSides = px.length;
  const inSides = qx.length;

  const totalLambdaNum = outSides * inSides;
  const objectiveCoef = Array(outSides * 2);
  for (let i = 0; i < objectiveCoef.length; i++) {
    objectiveCoef[i] = i < outSides ? -px[i] : px[i - outSides];
  }

  const objective = createObjective(outSides, objectiveCoef);

  const subjectTo = [];

  let consCount = 1;
  const lambdaNames = [];
  for (let i = 0; i < inSides; i++) {
    const object = {
      name: `c${consCount}`,
      vars: [],
      bnds: { type: 5, ub: 1.0, lb: 1.0 },
    };

    for (let j = 0; j < outSides; j++) {
      lambdaNames.push(`lambda${i + 1}${j}`);
      object.vars.push({ name: lambdaNames[i * outSides + j], coef: 1.0 });
    }

    consCount += 1;
    subjectTo.push(object);
  }

  console.log(subjectTo);

  return objective;
}

//LP解から拡大倍率とx,y軸方向に並行移動する値を求める関数
function culcResizeValue(data, px, py, qx, qy) {
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
  const S = (qx[1] - qx[0]) / (resizeX[1] - resizeX[0]);
  const dx = qx[0] - S * resizeX[0];
  const dy = qy[0] - S * resizeY[0];
  return [S, dx, dy];
}

// テストケース
//pは周りの多角形の座標
const p_x = [
  84.71806249273098, 76.3102293785846, 223.3695684469413, 328.77480252306344,
  248.8355904076537,
];
const p_y = [
  279.8880824020763, 108.00636224645602, 82.23245600370788, 182.48461966538346,
  330.351186353769,
];

//qは内側の多角形の座標
const q_x = [
  145.99568420051924, 193.95783243765567, 253.38220885322718,
  191.44643311455903,
];
const q_y = [
  200.23112133304835, 152.81671477805406, 199.8565843194025, 252.35425881702227,
];

let result;
await solveLp(makeLpObject(p_x, p_y, q_x, q_y)).then(
  (data) => {
    result = data.result;
  },
  (err) => {
    result = err.result;
  }
);

const [S, dx, dy] = culcResizeValue(result, p_x, p_y, q_x, q_y);
console.log(S, dx, dy);

makeLpObject(p_x, p_y, q_x, q_y);

const c1 = []; //目的関数の係数
const varNum = p_x.length * q_x.length;
for (let i = 0; i < varNum; i++) {
  if (i < p_x.length) {
    c1[i] = -p_x[i];
  } else if (i < p_x.length * 2) {
    c1[i] = p_x[i - p_x.length];
  } else {
    c1[i] = 0;
  }
}

const testA_ineq = [
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1],
  [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [
    5034.31803477, 4534.68779495, 13273.5973152, 19537.2376211, 14786.89979,
    -9097.57830641, -8194.69032842, -23986.8816687, -35305.9834363,
    -26721.5892638, 4063.26027164, 3660.00253347, 10713.2843535, 15768.7458152,
    11934.6894738, 0, 0, 0, 0, 0,
  ],
  [
    -212.760884798, -191.645458407, -560.970182998, -825.684816508,
    -624.925533312, -3850.49938684, -3468.35707506, -10152.3141705,
    -14943.0609987, -11309.7639405, 0, 0, 0, 0, 0, 4063.26027164, 3660.00253347,
    10713.2843535, 15768.7458152, 11934.6894738,
  ],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [
    -17440.8903556, -8798.42139668, -14534.9807751, -24341.0165313,
    -27642.7444192, 17440.8903556, 8798.42139668, 14534.9807751, 24341.0165313,
    27642.7444192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    -13455.7637481, -5208.79816204, -4027.70541586, -8875.49271209,
    -15937.5507091, 31.7300501279, 28.5810054221, 83.6601711055, 123.138332699,
    93.1981389201, 13424.033698, 5180.21715662, 3944.04524475, 8752.35437939,
    15844.3525702, 0, 0, 0, 0, 0,
  ],
  [
    -9008.26247929, -1202.68857928, 7698.67748114, 8384.41985379,
    -2874.26088049, -4415.77121868, -3977.52857733, -11642.7227259,
    -17136.7742332, -12970.0916897, 0, 0, 0, 0, 0, 13424.033698, 5180.21715662,
    3944.04524475, 8752.35437939, 15844.3525702,
  ],
  [
    -5034.31803477, -4534.68779495, -13273.5973152, -19537.2376211,
    -14786.89979, 9097.57830641, 8194.69032842, 23986.8816687, 35305.9834363,
    26721.5892638, 4063.26027164, 3660.00253347, 10713.2843535, 15768.7458152,
    11934.6894738, 0, 0, 0, 0, 0,
  ],
  [
    212.760884798, 191.645458407, 560.970182998, 825.684816508, 624.925533312,
    3850.49938684, 3468.35707506, 10152.3141705, 14943.0609987, 11309.7639405,
    0, 0, 0, 0, 0, -4063.26027164, -3660.00253347, -10713.2843535,
    -15768.7458152, -11934.6894738,
  ],
  [
    17440.8903556, 8798.42139668, 14534.9807751, 24341.0165313, 27642.7444192,
    -17440.8903556, -8798.42139668, -14534.9807751, -24341.0165313,
    -27642.7444192, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [
    13455.7637481, 5208.79816204, 4027.70541586, 8875.49271209, 15937.5507091,
    -31.7300501279, -28.5810054221, -83.6601711055, -123.138332699,
    -93.1981389201, -13424.033698, -5180.21715662, -3944.04524475,
    -8752.35437939, -15844.3525702, 0, 0, 0, 0, 0,
  ],
  [
    9008.26247929, 1202.68857928, -7698.67748114, -8384.41985379, 2874.26088049,
    4415.77121868, 3977.52857733, 11642.7227259, 17136.7742332, 12970.0916897,
    0, 0, 0, 0, 0, -13424.033698, -5180.21715662, -3944.04524475,
    -8752.35437939, -15844.3525702,
  ],
];

const testb_ineq = [
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
];

const test_result = simplexMethod(c1, testA_ineq, testb_ineq);
//const test_result = simplexMethod([-4,4],[[4,-1],[2,2],[3,-1],[-3,1],[-1,0],[0,-1]],[15,40,8,-8,0,0]);
//console.log("Test Optimal Value:", test_result.optimalValue,test_result.solution);

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
                          Math.abs(a * cx + b * cy + c) / Math.hypot(a, b) - 2
                        );
                      }

                      let q = getConvexHull(node.data.word);
                      console.log(node.data.word, q);

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
                              (r / r0) * 1.1
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
