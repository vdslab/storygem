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

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  const nodeColor = {};
  nodeColor[root.id] = "none";
  for (const cluster of root.children) {
    const color = colorScale(cluster.id);
    for (const node of cluster.descendants()) {
      nodeColor[node.id] = color;
    }
  }

  const chartR = chartSize / 2;
  const yScale = 2;
  const numberOfSides = 8;
  const dt = (2 * Math.PI) / numberOfSides;
  const ellipse = d3
    .range(numberOfSides)
    .map((item) => [
      chartR * Math.cos(item * dt),
      yScale * chartR * Math.sin(item * dt),
    ]);

  const _voronoiTreemap = voronoiTreemap().clip(ellipse);
  _voronoiTreemap(root);
  for (const node of root.descendants()) {
    if (node.polygon.site) {
      node.polygon.site.y /= yScale;
    }
    for (const item of node.polygon) {
      item[1] /= yScale;
    }
  }

  const allNodes = root.descendants().sort((a, b) => a.depth - b.depth);

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
                      stroke={"rgba(255,255,255,0.5)"}
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
                    <g key={node.id}>
                      <text
                        x={node.polygon.site.x}
                        y={node.polygon.site.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="10"
                        fontWeight="bold"
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
