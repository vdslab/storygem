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

export const regions = [
  {
    label: "Rectangle (Horizontal)",
    points: [
      [0, 0],
      [0, 500],
      [1000, 500],
      [1000, 0],
    ],
  },
  {
    label: "Rectangle (Vertical)",
    points: [
      [0, 0],
      [0, 1000],
      [500, 1000],
      [500, 0],
    ],
  },
  {
    label: "Square",
    points: [
      [0, 0],
      [0, 1000],
      [1000, 1000],
      [1000, 0],
    ],
  },
  { label: "Hexagon", points: regularPolygon(6) },
  { label: "Octagon", points: regularPolygon(8) },
  { label: "Circle", points: regularPolygon(100) },
];
