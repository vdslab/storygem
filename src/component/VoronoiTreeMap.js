import React, { useState } from "react"
import { extent, line, curveLinearClosed } from "d3"
import { times } from "lodash-es"
import seedrandom from "seedrandom"
import { voronoiMapSimulation } from "d3-voronoi-map"

const DEBUG = false

//配列内の最小値と最大値の差を求める関数
const extentLength = (array) => {
  const [min, max] = extent(array)
  return max - min
}

//配列内最小値と最大値の平均を求める関数
const extentMean = (array) => {
  const [min, max] = extent(array)
  return (max + min) / 2
}

const computeCirclePolygon = (radius,pointsCount=60) => {
  const increment = (2 * Math.PI) / pointsCount

  return times(pointsCount).map((i) => {
    const a = increment * (i + 1)
    return [radius + radius * Math.cos(a), radius + radius * Math.sin(a)]
  })
}

const buildVoronoiTree = (dataset,weightAccessor,radius=150) => {
  const seedPrng = seedrandom("hello")

  dataset = dataset.filter((d) => weightAccessor(d) !== 0)

  const simulation = voronoiMapSimulation(dataset)
    .weight(weightAccessor)
    .prng(seedPrng)
    .clip(computeCirclePolygon(radius))
    .minWeightRatio(0)
    .convergenceRatio(0.001)
    .maxIterationCount(Infinity)
    .stop()

  let state = simulation.state() // { ended, polygons, iterationCount, convergenceRatio }
  let cycles = 0

  while (!state.ended) {
    simulation.tick()
    state = simulation.state()

    if (cycles > 200) throw new Error("MORE THAN 10k!")

    cycles++
  }

  const polygons = state.polygons 

  const cells = polygons.map((polygon, i) => ({
    datum: polygon.site.originalObject.data.originalData,
    polygon,
  }))

  return cells
}

const VoronoiTreeMap = ({
  margin,
  radius,
  dataset,
  weightAccessor,
  colorAccessor = () => "black",
  labelAccessor = () => "",
}) => {
  const cells = buildVoronoiTree(dataset, weightAccessor, radius)
  const svgWidth = radius * 2 + margin.right + margin.left
  const svgHeight = radius * 2 + margin.top + margin.bottom

  return (
    <svg className="-voronoi-treemap" width={svgWidth} height={svgHeight}>
      <g
        className="cells"
        transform={`translate(${[margin.left, margin.top]})`}
      >
        {cells.map((cell, i) => (
          <Cell
            key={cell.datum.id || i}
            cell={cell}
            color={colorAccessor(cell.datum)}
            label={labelAccessor(cell.datum)}
          />
        ))}
      </g>
    </svg>
  )
}

const buildPolygonPath = line()
  .x((d) => d[0])
  .y((d) => d[1])
  .curve(curveLinearClosed)

const Cell = ({ cell, color, label = null }) => {
  const { polygon } = cell

  const selectedCell = {}
  const setHoveredCell = (x) => {}
  const setSelectedCell = (x) => {
    console.log(x)
  }

  const [opacity, setOpacity] = useState(1)

  const cx = extentMean(polygon.map((p) => p[0]))
  const cy = extentMean(polygon.map((p) => p[1]))
  const w = extentLength(polygon.map((p) => p[0]))
  const isSelected = cell === selectedCell

  return (
    <>
      <path
        className="-cell"
        d={buildPolygonPath(polygon)}
        fill={color}
        stroke={isSelected ? "black" : "white"}
        strokeWidth={isSelected ? 2 : 1}
        opacity={opacity}
        onMouseEnter={() => {
          setHoveredCell(cell.datum)
          setOpacity(0.8)
        }}
        onMouseLeave={() => {
          setHoveredCell(null)
          setOpacity(1)
        }}
        onClick={() => setSelectedCell(cell.datum)}
      ></path>

      {label && (
        <>
          {DEBUG && (
            <rect
              x={cx - w / 2}
              y={cy - 20}
              width={w}
              height={40}
              fill="none"
              stroke="orange"
            />
          )}
          <text // use @vx/text to have automatic word-wrapping
            x={cx}
            y={cy}
            width={w}
            fontSize={12}
            fontWeight="200"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ pointerEvents: "none", fill: "white" }}
          >
            {label}
          </text>
        </>
      )}
    </>
  )
}

export default VoronoiTreeMap;