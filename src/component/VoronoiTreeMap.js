import { hierarchy, range, scaleOrdinal } from "d3";
import * as d3Collection from 'd3-collection';
import { voronoiTreemap } from "d3-voronoi-treemap";
//import defaultData from "../data/einglishNews.json"

const VoronoiTreeMap = (props) => {
  const nested = d3Collection.nest()
  .key(d => d.type)
  .entries(props.data);

  //階層の設定
  const hier = hierarchy({ key: "donation", values: nested }, d => d.values).sum(
    d => +d.amount
  );

  let chartSize = 1000,
    margin = {
      top: 20,
      right: 20,
      bottom: 20,
      left: 20
    };

  const donationTypes = [...new Set(props.data.map(d => d.type))];
  const colorScale = scaleOrdinal()
    .domain(donationTypes)
    .range([
      "#3f0d12",
      "#a71d31",
      "#f1f0cc",
      "#d5bf86",
      "#8d775f",
      "#ff8360",
      "#f4afb4",
      "#797d81",
      "#4e6e5d",
      "#00a7e1"
    ]);
  

  const colorHierarchy = (h) => {
    if (h.depth === 0) {
      ///階層0なら色なし
      h.color = "none";
    } else if (h.depth === 1) {
      //階層1ならカラースケールから色を設定
      h.color = colorScale(h.data.key);
    } else {
      h.color = h.parent.color;
    }
    if (h.children) {
      //子にも同じ処理を再起的にする
      h.children.forEach(child => colorHierarchy(child));
    }
  }

  const ellipse = range(100).map((item,index) => [
    (chartSize * (1 + 0.99 * Math.cos((item / 50) * Math.PI))) / 2,
    (chartSize * (1 + 0.99 * Math.sin((item / 50) * Math.PI))) / 2
  ]);

  const _voronoiTreemap = voronoiTreemap().clip(ellipse);

  colorHierarchy(hier);
  _voronoiTreemap(hier);

  const allNodes = hier
    .descendants()
    .sort((a, b) => b.depth - a.depth)
    .map((d, i) => Object.assign({}, d, { id: i }));
  
  return (
    <div className="has-text-centered">
      <svg width={chartSize+margin.left} height={chartSize+margin.top}>
        <g>
          <g>
            {
              (function (){
                const list = [];
                for(let node of allNodes){
                  let svgText;
                  if(node.parent !== null){
                    svgText = <text 
                                x={node.polygon.site.x} 
                                y = {node.polygon.site.y}
                                textAnchor="middle" 
                                dominantBaseline="central"
                              >
                                {node.data.org}
                              </text>
                  }
                  list.push(
                    <g>
                      <path 
                        d = {"M" + node.polygon.join("L") + "Z"}
                        fill = {node.parent ? node.parent.color : node.color}
                        stroke = {"rgba(255,255,255,0.5)"}
                      />
                      {svgText}
                    </g>
                  )
                }
                return list;
              }())
            }
          </g>
        </g>
      </svg>
    </div>
  );
}

export default VoronoiTreeMap;