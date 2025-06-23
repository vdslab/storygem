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

const NonConvexVoronoiTreeMap = ({ data, showTextPolygon, showConvexHull }) => {
  const svgRef = useRef();

  if (data == null) {
    return null;
  }

  const { cells, outsideRegion, convexHull, styleContent } = data;
  
  // 総面積と各セルの統計情報を計算
  const totalArea = cells.reduce((sum, cell) => sum + (cell.actualArea || 0), 0);
  const cellStats = cells.map(cell => ({
    id: cell.id,
    word: cell.data?.word || "",
    originalWeight: cell.originalWeight || cell.value || 0,
    actualArea: cell.actualArea || 0,
    areaRatio: cell.areaRatio || 0,
    targetRatio: cell.value / cells.reduce((sum, c) => sum + c.value, 0)
  }));
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
            <defs>
              <style>{styleContent}</style>
            </defs>
            {/* 非凸領域の外枠 */}
            <path
              d={"M" + outsideRegion.join("L") + "Z"}
              fill="none"
              stroke={fontColor}
              strokeWidth={2}
              strokeDasharray="5,5"
            />
            
            {/* 凸包（凸領域）の表示 */}
            {showConvexHull && convexHull && (
              <path
                d={"M" + convexHull.join("L") + "Z"}
                fill="rgba(255, 0, 0, 0.1)"
                stroke="rgba(255, 0, 0, 0.5)"
                strokeWidth={2}
                strokeDasharray="10,5"
              />
            )}
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
        
        {/* 重みと面積の統計情報テーブル */}
        <div className="box mt-4">
          <h3 className="title is-5">領域の重みと面積情報</h3>
          <div className="table-container">
            <table className="table is-striped is-hoverable is-fullwidth">
              <thead>
                <tr>
                  <th>単語</th>
                  <th>設定重み</th>
                  <th>実際の面積</th>
                  <th>面積比率</th>
                  <th>目標比率</th>
                  <th>誤差</th>
                </tr>
              </thead>
              <tbody>
                {cellStats
                  .filter(stat => stat.word) // 単語がある領域のみ表示
                  .sort((a, b) => b.actualArea - a.actualArea) // 面積の大きい順にソート
                  .map((stat) => {
                    const error = Math.abs(stat.areaRatio - stat.targetRatio);
                    const errorPercent = stat.targetRatio > 0 ? (error / stat.targetRatio * 100) : 0;
                    return (
                      <tr key={stat.id}>
                        <td>{stat.word}</td>
                        <td>{stat.originalWeight.toFixed(2)}</td>
                        <td>{stat.actualArea.toFixed(2)}</td>
                        <td>{(stat.areaRatio * 100).toFixed(2)}%</td>
                        <td>{(stat.targetRatio * 100).toFixed(2)}%</td>
                        <td className={errorPercent > 10 ? "has-text-danger" : errorPercent > 5 ? "has-text-warning" : "has-text-success"}>
                          {errorPercent.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr>
                  <th>合計</th>
                  <th>-</th>
                  <th>{totalArea.toFixed(2)}</th>
                  <th>100.00%</th>
                  <th>100.00%</th>
                  <th>-</th>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="help">
            <span className="has-text-success">● 誤差5%未満</span>
            <span className="has-text-warning ml-3">● 誤差5-10%</span>
            <span className="has-text-danger ml-3">● 誤差10%以上</span>
          </p>
        </div>
      </section>
    </div>
  );
};

export default NonConvexVoronoiTreeMap;
