import * as d3 from "d3";

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
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    result.push([500 + scale * x, 500 - scale * y]);
  }
  
  return result;
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
];
