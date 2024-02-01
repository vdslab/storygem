import { useRef } from "react";
import { fontSize } from "../fonts";
import { SVGConverter } from "../image";

const RenderingText = ({ node, color }) => {
  const { s, dx, dy, a, lines } = node.textTransform;
  return (
    <g key={node.id}>
      {lines.map((line, i) => {
        return (
          <text
            key={i}
            fontSize={fontSize}
            fontFamily={node.fontFamily}
            fill={color}
            transform={`translate(${dx},${dy})scale(${s})rotate(${a})`}
            y={fontSize * i}
          >
            {line}
          </text>
        );
      })}
    </g>
  );
};

const download = (url, filename) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
};

const VoronoiTreeMap = ({ data, showTextPolygon }) => {
  const svgRef = useRef();

  if (data == null) {
    return null;
  }

  const { cells, outsideRegion } = data;
  const maxHeight = Math.max(...cells.map((cell) => cell.height + 1));
  const fontColor = "#444";
  const margin = {
    top: maxHeight / 2,
    right: maxHeight / 2,
    bottom: maxHeight / 2,
    left: maxHeight / 2,
  };
  const outsideLeft = Math.min(...outsideRegion.map((p) => p[0]));
  const outsideRight = Math.max(...outsideRegion.map((p) => p[0]));
  const outsideTop = Math.min(...outsideRegion.map((p) => p[1]));
  const outsideBottom = Math.max(...outsideRegion.map((p) => p[1]));
  const displayWidth = outsideRight - outsideLeft + margin.left + margin.right;
  const displayHeight = outsideBottom - outsideTop + margin.top + margin.bottom;

  async function initConverter() {
    return await SVGConverter.loadFromElement(
      svgRef.current,
      displayWidth,
      displayHeight,
    );
  }
  return (
    <div className="container">
      <section className="section">
        <figure className="image">
          <svg
            ref={svgRef}
            className="has-ratio"
            viewBox={`${outsideLeft - margin.left} ${outsideTop - margin.top} ${displayWidth} ${displayHeight}`}
          >
            <g>
              {cells.map((node) => {
                return (
                  <g key={node.id}>
                    <path
                      d={"M" + node.polygon.join("L") + "Z"}
                      fill={node.color}
                      stroke={fontColor}
                      strokeWidth={node.height + 1}
                    />
                  </g>
                );
              })}
            </g>
            {showTextPolygon && (
              <g>
                {cells
                  .filter((node) => node.data.word)
                  .map((node) => {
                    return (
                      <g key={node.id}>
                        <path
                          d={"M" + node.textTransform.polygon.join("L") + "Z"}
                          fill="#888"
                          opacity="0.5"
                          stroke={fontColor}
                          strokeWidth={node.height + 1}
                        />
                      </g>
                    );
                  })}
              </g>
            )}
            <g>
              {cells
                .filter((node) => node.data.word)
                .map((node) => {
                  return (
                    <RenderingText
                      key={node.id}
                      node={node}
                      color={fontColor}
                    />
                  );
                })}
            </g>
          </svg>
        </figure>
        <div className="field is-grouped">
          <div className="control">
            <button
              className="button is-light is-small"
              onClick={async () => {
                const converter = await initConverter();
                download(await converter.svgURL(), "image.svg");
              }}
            >
              Save as SVG
            </button>
          </div>
          <div className="control">
            <button
              className="button is-light is-small"
              onClick={async () => {
                const converter = await initConverter();
                download(await converter.pngURL(), "image.png");
              }}
            >
              Save as PNG
            </button>
          </div>
          <div className="control">
            <button
              className="button is-light is-small"
              onClick={async () => {
                const converter = await initConverter();
                download(await converter.jpegURL(), "image.jpeg");
              }}
            >
              Save as JPEG
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default VoronoiTreeMap;
