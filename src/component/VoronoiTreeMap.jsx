import { useRef, useMemo, useEffect, useState } from "react";
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

const VoronoiTreeMap = ({ data, language, showTextPolygon }) => {
  const svgRef = useRef();
  const [openAIResponse, setOpenAIResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (data == null) {
    return null;
  }

  const { cells, outsideRegion, styleContent } = data;
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

  const groupedWords = useMemo(() => {
    const groups = {};
    const heightTwoNodes = cells.filter((node) => node.height === 2);
    let count = 1;

    heightTwoNodes.forEach((node) => {
      if (Array.isArray(node.children)) {
        node.children.forEach((item) => {
          if (Array.isArray(item.children)) {
            item.children.forEach((child) => {
              const { word } = child.data;
              if (word) {
                if (!groups["cluster" + count]) {
                  groups["cluster" + count] = [];
                }
                groups["cluster" + count].push(word);
              }
            });
          }
        });
      }
      count++;
    });

    return groups;
  }, [cells]);

  useEffect(() => {}, [groupedWords]);

  const sendToOpenAI = async () => {
    setIsLoading(true);
    setError(null);
    setOpenAIResponse(null);
    try {
      const response = await fetch("http://localhost:5000/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groupedWords, lang: language }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setOpenAIResponse(data.text);
    } catch (err) {
      console.error(err);
      setError("Error communicating with OpenAI API");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <section className="section">
        <figure className="image">
          <svg
            ref={svgRef}
            className="has-ratio"
            viewBox={`${outsideLeft - margin.left} ${outsideTop - margin.top} ${displayWidth} ${displayHeight}`}
          >
            <defs>
              <style>{styleContent}</style>
            </defs>
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
                  .filter(
                    (node) =>
                      node.data &&
                      Array.isArray(node.data) &&
                      node.data.length > 0,
                  )
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
          <div className="control">
            <button
              className="button is-primary is-small"
              onClick={sendToOpenAI}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Send to OpenAI"}
            </button>
          </div>
        </div>
        {error && <div className="notification is-danger">{error}</div>}
        {openAIResponse && (
          <div className="notification is-info">
            <h2 className="title is-4">OpenAI Response</h2>
            <p>{openAIResponse}</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default VoronoiTreeMap;
