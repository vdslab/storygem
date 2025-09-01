import * as d3 from "d3";
import {
  parseSVGPath,
  loadSVGPath,
  simplifyPoints,
} from "./utils/svgPathParser";

function regularPolygon(numberOfSides) {
  const chartSize = 1000;
  const chartR = chartSize / 2;
  const dt = (2 * Math.PI) / numberOfSides;
  return d3
    .range(numberOfSides)
    .map((item) => [
      chartR * Math.cos(item * dt),
      chartR * Math.sin(item * dt),
    ]);
}

function createLShape() {
  const size = 1000;
  const width = size / 3;
  return [
    [0, 0],
    [0, size],
    [width, size],
    [width, width],
    [size, width],
    [size, 0],
  ];
}

function createStarShape() {
  const outerRadius = 500;
  const innerRadius = 200;
  const points = 5;
  const result = [];

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / points) * i;
    result.push([
      500 + radius * Math.sin(angle),
      500 - radius * Math.cos(angle),
    ]);
  }

  return result;
}

function createCrossShape() {
  const size = 1000;
  const width = size / 3;
  return [
    [width, 0],
    [width * 2, 0],
    [width * 2, width],
    [size, width],
    [size, width * 2],
    [width * 2, width * 2],
    [width * 2, size],
    [width, size],
    [width, width * 2],
    [0, width * 2],
    [0, width],
    [width, width],
  ];
}

function createHeartShape() {
  const scale = 15;
  const points = 50;
  const result = [];

  for (let i = 0; i < points; i++) {
    const t = (2 * Math.PI * i) / points;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    result.push([500 + scale * x, 500 - scale * y]);
  }

  return result;
}

// 横長のT字型
function createHorizontalTShape() {
  const width = 1000;
  const height = 600;
  const stemWidth = 300;
  const stemHeight = 200;
  return [
    [0, 0],
    [0, stemHeight],
    [(width - stemWidth) / 2, stemHeight],
    [(width - stemWidth) / 2, height],
    [(width + stemWidth) / 2, height],
    [(width + stemWidth) / 2, stemHeight],
    [width, stemHeight],
    [width, 0],
  ];
}

function createHorizontalUShape() {
  const width = 1000;
  const height = 600;
  const thickness = 150;
  return [
    [0, 0],
    [0, height],
    [thickness, height],
    [thickness, thickness],
    [width - thickness, thickness],
    [width - thickness, height],
    [width, height],
    [width, 0],
  ];
}

function createHorizontalStepsShape() {
  const width = 1000;
  const height = 600;
  const steps = 4;
  const stepWidth = width / steps;
  const stepHeight = height / steps;

  const points = [[0, 0]];

  for (let i = 0; i < steps; i++) {
    points.push([(i + 1) * stepWidth, i * stepHeight]);
    points.push([(i + 1) * stepWidth, (i + 1) * stepHeight]);
  }

  points.push([width, height]);
  points.push([0, height]);

  return points;
}

async function createShapeFromSVG(svgPath, flipY = true) {
  try {
    const { pathData, translateX, translateY } = await loadSVGPath(svgPath);

    const scale = 1.5;
    const offsetX = 500;
    const offsetY = 500;

    let points = parseSVGPath(
      pathData,
      scale,
      offsetX - translateX * scale,
      offsetY - translateY * scale,
    );

    if (flipY) {
      const yValues = points.map((p) => p[1]);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);
      const centerY = (minY + maxY) / 2;

      points = points.map(([x, y]) => [x, 2 * centerY - y]);
    }

    return simplifyPoints(points, 5);
  } catch (error) {
    console.error("Error loading SVG:", error);
  }
}


export const regions = [
  {
    label: "Rectangle (Horizontal)",
    points: [
      [0, 0],
      [0, 500],
      [1000, 500],
      [1000, 0],
    ],
    isConvex: true,
  },
  {
    label: "Rectangle (Vertical)",
    points: [
      [0, 0],
      [0, 1000],
      [500, 1000],
      [500, 0],
    ],
    isConvex: true,
  },
  {
    label: "Square",
    points: [
      [0, 0],
      [0, 1000],
      [1000, 1000],
      [1000, 0],
    ],
    isConvex: true,
  },
  { label: "Hexagon", points: regularPolygon(6), isConvex: true },
  { label: "Octagon", points: regularPolygon(8), isConvex: true },
  { label: "Circle", points: regularPolygon(100), isConvex: true },
  { label: "L Shape", points: createLShape(), isConvex: false },
  { label: "Star Shape", points: createStarShape(), isConvex: false },
  { label: "Cross Shape", points: createCrossShape(), isConvex: false },
  { label: "Heart Shape", points: createHeartShape(), isConvex: false },
  {
    label: "Horizontal T Shape",
    points: createHorizontalTShape(),
    isConvex: false,
  },
  {
    label: "Horizontal U Shape",
    points: createHorizontalUShape(),
    isConvex: false,
  },
  {
    label: "Horizontal Steps",
    points: createHorizontalStepsShape(),
    isConvex: false,
  },
];

export { createShapeFromSVG };
