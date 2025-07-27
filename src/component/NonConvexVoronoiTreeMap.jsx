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

const NonConvexVoronoiTreeMap = ({ data, showTextPolygon, showConvexHull, adjustColorByWeight = true }) => {
  const svgRef = useRef();

  if (data == null) {
    return null;
  }

  const { cells, outsideRegion, convexHull, styleContent } = data;

  const weights = cells.map(cell => cell.originalWeight || cell.value || 0);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = maxWeight - minWeight || 1;

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const hslToRgb = (h, s, l) => {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  };

  // 重みに基づいて色の明度を調整する関数
  const adjustColorByWeightValue = (color, weight) => {
    const rgb = hexToRgb(color);
    if (!rgb) return color;
    
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const normalizedWeight = (weight - minWeight) / weightRange;
    
    // 明度を調整（重みが大きいほど暗く、小さいほど明るく）
    // 明度の範囲を35%〜85%に設定（暗すぎず、より見やすい範囲）
    hsl.l = 85 - (normalizedWeight * 50);
    
    // 彩度は変更しない（元の色の鮮やかさを保持）
    
    return hslToRgb(hsl.h, hsl.s, hsl.l);
  };

  // 総面積と各セルの統計情報を計算
  const totalArea = cells.reduce(
    (sum, cell) => sum + (cell.actualArea || 0),
    0,
  );
  const cellStats = cells.map((cell) => ({
    id: cell.id,
    word: cell.data?.word || "",
    originalWeight: cell.originalWeight || cell.value || 0,
    actualArea: cell.actualArea || 0,
    areaRatio: cell.areaRatio || 0,
    targetRatio: cell.value / cells.reduce((sum, c) => sum + c.value, 0),
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
                // 重みに基づいて色の明度を調整（設定が有効な場合のみ）
                const weight = node.originalWeight || node.value || 0;
                const fillColor = adjustColorByWeight 
                  ? adjustColorByWeightValue(node.color, weight)
                  : node.color;
                
                return (
                  <g key={node.id}>
                    <path
                      d={"M" + node.polygon.join("L") + "Z"}
                      fill={fillColor}
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
                  .filter((stat) => stat.word) // 単語がある領域のみ表示
                  .sort((a, b) => b.actualArea - a.actualArea) // 面積の大きい順にソート
                  .map((stat) => {
                    const error = Math.abs(stat.areaRatio - stat.targetRatio);
                    const errorPercent =
                      stat.targetRatio > 0
                        ? (error / stat.targetRatio) * 100
                        : 0;
                    return (
                      <tr key={stat.id}>
                        <td>{stat.word}</td>
                        <td>{stat.originalWeight.toFixed(2)}</td>
                        <td>{stat.actualArea.toFixed(2)}</td>
                        <td>{(stat.areaRatio * 100).toFixed(2)}%</td>
                        <td>{(stat.targetRatio * 100).toFixed(2)}%</td>
                        <td
                          className={
                            errorPercent > 10
                              ? "has-text-danger"
                              : errorPercent > 5
                                ? "has-text-warning"
                                : "has-text-success"
                          }
                        >
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
