import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";

const VoronoiTreeMap = ({ data }) => {
  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  root.sum((d) => Math.sqrt(d.weight));

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
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `bold ${fontSize}px '${fontFamily}'`;

  return (
    <div className="has-text-centered">
      <svg
        width={chartSize + margin.left + margin.right}
        height={chartSize + margin.top + margin.bottom}
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
                          r / r0
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
    </div>
  );
};

export default VoronoiTreeMap;
