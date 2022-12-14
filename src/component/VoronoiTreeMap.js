import * as d3 from "d3";
import { voronoiTreemap } from "d3-voronoi-treemap";

const VoronoiTreeMap = ({ data }) => {
  const stratify = d3.stratify();
  const root = stratify(data);
  d3.hierarchy(root);
  root.sum((d) => d.weight);

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

  const ellipse = d3
    .range(100)
    .map((item, index) => [
      (chartSize * (1 + 0.99 * Math.cos((item / 50) * Math.PI))) / 2,
      (chartSize * (1 + 0.99 * Math.sin((item / 50) * Math.PI))) / 2,
    ]);

  const _voronoiTreemap = voronoiTreemap().clip(ellipse);

  _voronoiTreemap(root);

  const allNodes = root.descendants().sort((a, b) => a.depth - b.depth);

  return (
    <div className="has-text-centered">
      <svg width={chartSize + margin.left} height={chartSize + margin.top}>
        <g>
          <g>
            {(function () {
              const list = [];
              for (let node of allNodes) {
                let svgText;
                if (node.parent !== null) {
                  svgText = (
                    <text
                      x={node.polygon.site.x}
                      y={node.polygon.site.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {node.data.word}
                    </text>
                  );
                }
                list.push(
                  <g>
                    <path
                      d={"M" + node.polygon.join("L") + "Z"}
                      fill={nodeColor[node.data.id]}
                      stroke={"rgba(255,255,255,0.5)"}
                    />
                    {svgText}
                  </g>,
                );
              }
              return list;
            })()}
          </g>
        </g>
      </svg>
    </div>
  );
};

export default VoronoiTreeMap;
