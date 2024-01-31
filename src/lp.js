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
      const name = `lambda${i}_${j + 1}`;
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

const initAffinObj = () => {
  const affinObj = {
    name: "",
    vars: [],
    bnds: { type: 5, ub: 0.0, lb: 0.0 },
  };
  return affinObj;
};

//LPソルバーに入れるオブジェクトを作成する関数
export const makeLpObject = (
  outsidesXPoints,
  outsidesYPoints,
  insidesXpoints,
  insidesYpoints,
) => {
  const outSides = outsidesXPoints.length;
  const inSides = insidesXpoints.length;
  const objective = createObjective(outsidesXPoints);

  //lambdaの名前を保持する配列の作成
  const lambdaNames = Array(inSides);
  for (let i = 0; i < inSides; i++) {
    lambdaNames[i] = Array(outSides);
    for (let j = 0; j < outSides; j++) {
      lambdaNames[i][j] = `lambda${i + 1}_${j + 1}`;
    }
  }

  //最適化後の多角形の各頂点が凸包の内側にある制約
  const subjectTo = [];
  for (let lambdaINames of lambdaNames) {
    const inConvexObj = {
      name: "",
      vars: [],
      bnds: { type: 5, ub: 1.0, lb: 1.0 },
    };

    for (let lambdaName of lambdaINames) {
      inConvexObj.vars.push({ name: lambdaName, coef: 1.0 });
      //lambdaの非負制約
      const nonNegObj = {
        name: "",
        vars: [{ name: lambdaName, coef: 1.0 }],
        bnds: { type: 3, ub: 1.0, lb: 0.0 },
      };
      subjectTo.push(nonNegObj);
    }
    subjectTo.push(inConvexObj);
  }

  //アフィン変換で得られる制約
  for (let i = 0; i < inSides; i++) {
    const diff1st2ndX = insidesXpoints[1] - insidesXpoints[0];
    const diff2ndIX = insidesXpoints[1] - insidesXpoints[i];
    const diff1stIX = insidesXpoints[0] - insidesXpoints[i];
    const diff1stIY = insidesYpoints[0] - insidesYpoints[i];
    //lambdaの係数を初期化
    const lambdaCoefsX = initlambdaCoefDict(lambdaNames);
    const lambdaCoefsY = initlambdaCoefDict(lambdaNames);
    for (let j = 0; j < outSides; j++) {
      //xについての制約
      lambdaCoefsX[`lambda${i + 1}_${j + 1}`] +=
        diff1st2ndX * outsidesXPoints[j];
      lambdaCoefsX[`lambda1_${j + 1}`] += -diff2ndIX * outsidesXPoints[j];
      lambdaCoefsX[`lambda2_${j + 1}`] += diff1stIX * outsidesXPoints[j];
      //yについての制約
      lambdaCoefsY[`lambda${i + 1}_${j + 1}`] +=
        diff1st2ndX * outsidesYPoints[j];
      lambdaCoefsY[`lambda1_${j + 1}`] += -diff1st2ndX * outsidesYPoints[j];
      lambdaCoefsY[`lambda2_${j + 1}`] += diff1stIY * outsidesXPoints[j];
      lambdaCoefsY[`lambda1_${j + 1}`] += -diff1stIY * outsidesXPoints[j];
    }
    //制約条件のセット
    const affinXObj = initAffinObj();
    for (let lambdaINames of lambdaNames) {
      for (let lambdaName of lambdaINames) {
        if (lambdaCoefsX[lambdaName] !== 0) {
          affinXObj.vars.push({
            name: lambdaName,
            coef: lambdaCoefsX[lambdaName],
          });
        }
      }
    }
    if (affinXObj.vars.length > 0) {
      subjectTo.push(affinXObj);
    }
    const affinYObj = initAffinObj();
    for (let lambdaINames of lambdaNames) {
      for (let lambdaName of lambdaINames) {
        if (lambdaCoefsY[lambdaName] !== 0) {
          affinYObj.vars.push({
            name: lambdaName,
            coef: lambdaCoefsY[lambdaName],
          });
        }
      }
    }
    if (affinYObj.vars.length > 0) {
      subjectTo.push(affinYObj);
    }
  }

  //制約条件のユニークな名前をつける
  for (let constraints of subjectTo) {
    constraints.name = `c${subjectTo.indexOf(constraints) + 1}`;
  }

  return [objective, subjectTo];
};
