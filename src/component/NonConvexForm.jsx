import { useEffect, useRef, useState } from "react";
import { fonts, defaultFont, fontSize } from "../fonts";
import { regions, createShapeFromSVG } from "../regions";
import NonConvexWorker from "../worker/nonconvex-worker?worker";
import { hyphenatedLines } from "../hyphenation";

const fetchWikipediaData = async (url) => {
  const langCode = url.split("/")[2].split(".")[0];
  let apiUrl;
  if (langCode === "ja") {
    const pageTitle = decodeURIComponent(url.split("/").pop());
    apiUrl = `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${pageTitle}`;
  } else {
    const pageTitle = decodeURIComponent(url.split("/").pop());
    apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&format=json&origin=*&titles=${pageTitle}`;
  }

  const response = await fetch(apiUrl);
  const data = await response.json();
  const pageId = Object.keys(data.query.pages)[0];
  return data.query.pages[pageId].extract;
};

const fetchRandomWikipediaUrl = async () => {
  const apiUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*";
  const response = await fetch(apiUrl);
  const data = await response.json();
  const pageTitle = data.query.random[0].title;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
};

const fetchGraph = async ({ text, words, nNeighbors, lang, weight }) => {
  const params = new URLSearchParams();
  params.append("words", words);
  params.append("n_neighbors", nNeighbors);
  params.append("lang", lang);
  params.append("weight", weight);
  const baseUrl = import.meta.env.DEV
    ? "/api"
    : import.meta.env.VITE_SERVER_URL;
  const url = `${baseUrl}/knn_graph?${params}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: text,
  });
  return response.json();
};

const textImageData = (text, fontFamily) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px ${fontFamily}`;
  // 単語を描画するのに十分なサイズを設定する
  canvas.width = 200;
  canvas.height = 200;
  const dx = 10;
  const dy = canvas.height / 2;
  ctx.font = `${fontSize}px ${fontFamily}`;
  text.forEach((line, i) => {
    ctx.fillText(line, dx, dy + fontSize * i);
  });
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const textMeasure = (text, fontFamily) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontSize}px ${fontFamily}`;
  const measure = ctx.measureText(text);
  return {
    width: measure.width,
    height: measure.height,
    actualBoundingBoxAscent: measure.actualBoundingBoxAscent,
  };
};

const layoutNonConvexVoronoiTreeMap = async (args) => {
  return new Promise((resolve) => {
    const worker = new NonConvexWorker();
    worker.onmessage = (event) => {
      resolve(event.data);
    };
    worker.postMessage(args);
  });
};

const fetchFont = async (fontFamily) => {
  const font = fonts.find((font) => font.name === fontFamily);
  if (!font.query) {
    return "";
  }
  const cssUrl = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap`;
  const cssResponse = await fetch(cssUrl);
  let css = await cssResponse.text();
  const re = /url\((.+?)\)/g;
  for (const item of css.matchAll(re)) {
    const fontUrl = item[1];
    const fontResponse = await fetch(fontUrl);
    const blob = await fontResponse.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", (event) => {
        resolve(event.target.result);
      });
      reader.readAsDataURL(blob);
    });
    css = css.replace(fontUrl, dataUrl);
  }
  return css;
};

const NonConvexForm = (props) => {
  const formRef = useRef();
  const [loading, setLoading] = useState(false);
  const [sizeOptimization, setSizeOptimization] = useState(true);
  const [customSvgData, setCustomSvgData] = useState(null);
  const [customSvgName, setCustomSvgName] = useState("");
  const [selectedRegionPreview, setSelectedRegionPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const nonConvexRegions = regions.filter((region) => !region.isConvex);

  // カスタムSVGがある場合は選択肢に追加
  const allRegions = customSvgData
    ? [
      ...nonConvexRegions,
      { label: `Custom: ${customSvgName}`, isCustom: true },
    ]
    : nonConvexRegions;

  const updateRegionPreview = async (regionLabel) => {
    setPreviewError(null);
    const selectedRegion = allRegions.find(
      ({ label }) => label === regionLabel,
    );

    if (!selectedRegion) {
      setSelectedRegionPreview(null);
      return;
    }

    try {
      let previewPoints;

      if (selectedRegion.isCustom && customSvgData) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(customSvgData, "image/svg+xml");
        const pathElement = doc.querySelector("path");

        if (pathElement) {
          const pathData = pathElement.getAttribute("d");
          const transform = pathElement.getAttribute("transform");

          let translateX = 0;
          let translateY = 0;
          if (transform) {
            const translateMatch = transform.match(
              /translate\(([^,]+),([^)]+)\)/,
            );
            if (translateMatch) {
              translateX = parseFloat(translateMatch[1]);
              translateY = parseFloat(translateMatch[2]);
            }
          }

          const { parseSVGPath, simplifyPoints } = await import(
            "../utils/svgPathParser"
          );
          const scale = 1.5;
          const offsetX = 500;
          const offsetY = 500;

          let points = parseSVGPath(
            pathData,
            scale,
            offsetX - translateX * scale,
            offsetY - translateY * scale,
          );

          // Y座標を反転
          const yValues = points.map((p) => p[1]);
          const minY = Math.min(...yValues);
          const maxY = Math.max(...yValues);
          const centerY = (minY + maxY) / 2;
          points = points.map(([x, y]) => [x, 2 * centerY - y]);

          previewPoints = simplifyPoints(points, 0.5);
        }
      } else if (selectedRegion.isDynamic && selectedRegion.svgPath) {
        previewPoints = await createShapeFromSVG(
          selectedRegion.svgPath,
          true,
        );
      } else {
        previewPoints = selectedRegion.points;
      }

      setSelectedRegionPreview(previewPoints);
    } catch (error) {
      console.error("Failed to generate preview:", error);
      setPreviewError("Failed to generate preview");
      setSelectedRegionPreview(null);
    }
  };

  useEffect(() => {
    if (nonConvexRegions.length > 0) {
      updateRegionPreview(nonConvexRegions[0].label);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const text = await fetchWikipediaData(
        "https://en.wikipedia.org/wiki/Dog",
      );
      formRef.current.elements.text.value = text;
    })();
  }, []);

  return (
    <div className="container">
      <section className="section">
        <h1 className="title">非凸領域のVoronoi Treemap</h1>
        <p className="subtitle"></p>
        <form
          ref={formRef}
          onSubmit={async (event) => {
            event.preventDefault();
            if (loading) {
              return;
            }
            props.setData(null);
            setLoading(true);
            try {
              const data = await fetchGraph({
                text: event.target.elements.text.value,
                words: event.target.elements.words.value,
                nNeighbors: event.target.elements.nNeighbors.value,
                lang: event.target.elements.lang.value,
                weight: event.target.elements.weight.value,
              });

              console.log("NonConvexForm - fetched data:", {
                dataLength: data.length,
                firstItems: data.slice(0, 5),
              });

              const rotate = event.target.elements.rotate.value;
              const selectedRegionLabel =
                event.target.elements.ousideRegion.value;
              const selectedRegion = allRegions.find(
                ({ label }) => label === selectedRegionLabel,
              );

              let outsideRegion;
              if (selectedRegion.isCustom && customSvgData) {
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(
                    customSvgData,
                    "image/svg+xml",
                  );
                  const pathElement = doc.querySelector("path");

                  if (pathElement) {
                    const pathData = pathElement.getAttribute("d");
                    const transform = pathElement.getAttribute("transform");

                    let translateX = 0;
                    let translateY = 0;
                    if (transform) {
                      const translateMatch = transform.match(
                        /translate\(([^,]+),([^)]+)\)/,
                      );
                      if (translateMatch) {
                        translateX = parseFloat(translateMatch[1]);
                        translateY = parseFloat(translateMatch[2]);
                      }
                    }

                    // svgPathParserを使用して解析
                    const { parseSVGPath, simplifyPoints } = await import(
                      "../utils/svgPathParser"
                    );
                    const scale = 1.5;
                    const offsetX = 500;
                    const offsetY = 500;

                    let points = parseSVGPath(
                      pathData,
                      scale,
                      offsetX - translateX * scale,
                      offsetY - translateY * scale,
                    );

                    // Y座標を反転
                    const yValues = points.map((p) => p[1]);
                    const minY = Math.min(...yValues);
                    const maxY = Math.max(...yValues);
                    const centerY = (minY + maxY) / 2;
                    points = points.map(([x, y]) => [x, 2 * centerY - y]);

                    outsideRegion = simplifyPoints(points, 0.5);
                  } else {
                    throw new Error("No path element found in custom SVG");
                  }
                } catch (error) {
                  console.error("Failed to parse custom SVG:", error);
                  alert(
                    "Failed to parse custom SVG. Please select a valid SVG file.",
                  );
                  return;
                }
              } else if (selectedRegion.isDynamic && selectedRegion.svgPath) {
                try {
                  outsideRegion = await createShapeFromSVG(
                    selectedRegion.svgPath,
                    true,
                  );
                } catch (error) {
                  console.error("Failed to load SVG shape:", error);
                  outsideRegion = selectedRegion.points;
                }
              } else {
                outsideRegion = selectedRegion.points;
              }

              const fontFamily = event.target.elements.fontFamily.value;
              const sizeOptimization =
                event.target.elements.sizeOptimization.value === "enabled"
                  ? {
                    rotateStep: rotate === "none" ? null : +rotate,
                    allowHyphenation:
                        event.target.elements.hyphenation.value === "enabled",
                  }
                  : null;

              for (const item of data) {
                if (item.word) {
                  if (sizeOptimization == null) {
                    item.textMeasure = textMeasure(item.word, fontFamily);
                  } else {
                    const separatedTexts = [[item.word]];
                    if (sizeOptimization.allowHyphenation) {
                      for (const lines of hyphenatedLines(item.word)) {
                        separatedTexts.push(lines);
                      }
                    }
                    item.wordPixels = separatedTexts.map((lines) => {
                      return {
                        lines,
                        imageData: textImageData(lines, fontFamily),
                      };
                    });
                  }
                }
              }

              console.log("NonConvexForm - sending to worker:", {
                dataLength: data.length,
                outsideRegionLength: outsideRegion.length,
                fontFamily,
                sizeOptimization,
                colorPalette: event.target.elements.colorPalette.value,
              });

              const result = await layoutNonConvexVoronoiTreeMap({
                data,
                outsideRegion,
                fontFamily,
                sizeOptimization,
                colorPalette: event.target.elements.colorPalette.value,
              });

              console.log("NonConvexForm - received result:", {
                cellsLength: result.cells?.length,
                convexHullLength: result.convexHull?.length,
              });
              const styleContent = await fetchFont(fontFamily);
              props.setData({
                cells: result.cells,
                outsideRegion,
                convexHull: result.convexHull,
                styleContent,
              });
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="field">
            <label className="label">Input Text</label>
            <div className="control">
              <textarea name="text" className="textarea" />
            </div>
          </div>
          <div className="field is-grouped is-grouped-multiline">
            <div className="control">
              <div className="file is-light is-small">
                <label className="file-label">
                  <input
                    className="file-input"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files[0];
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        formRef.current.elements.text.value =
                          event.target.result;
                      };
                      reader.readAsText(file);
                    }}
                  />
                  <span className="file-cta">
                    <span className="file-label">Load from File</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="control">
              <button
                className="button is-light is-small"
                onClick={async (event) => {
                  event.preventDefault();
                  const url = prompt("Enter Wikipedia URL");
                  const text = await fetchWikipediaData(url);
                  formRef.current.elements.text.value = text;
                }}
              >
                Fetch Wikipedia page
              </button>
            </div>
            <div className="control">
              <button
                className="button is-light is-small"
                onClick={async (event) => {
                  event.preventDefault();
                  const url = await fetchRandomWikipediaUrl();
                  const text = await fetchWikipediaData(url);
                  formRef.current.elements.text.value = text;
                }}
              >
                Fetch random Wikipedia page
              </button>
            </div>
          </div>
          <div className="field">
            <label className="label">Language</label>
            <div className="control">
              <div className="select is-fullwidth">
                <select name="lang" defaultValue="en">
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>
            </div>
          </div>
          <div className="columns is-multiline">
            <div className="column is-4">
              <div className="field">
                <label className="label">Number of Words</label>
                <div className="control">
                  <input
                    className="input"
                    name="words"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue="100"
                  />
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Number of Neighbors</label>
                <div className="control">
                  <input
                    className="input"
                    name="nNeighbors"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue="10"
                  />
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Word Weight</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select name="weight" defaultValue="tf-idf">
                      <option value="tf">TF</option>
                      <option value="tf-idf">TF-IDF</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Outside Region (非凸領域)</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select
                      name="ousideRegion"
                      defaultValue={nonConvexRegions[0].label}
                      onChange={(e) => updateRegionPreview(e.target.value)}
                    >
                      {allRegions.map((region) => {
                        return (
                          <option key={region.label} value={region.label}>
                            {region.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Font Family</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select name="fontFamily" defaultValue={defaultFont}>
                      {fonts.map((font) => {
                        return (
                          <option key={font.name} value={font.name}>
                            {font.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Color Palette</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select name="colorPalette" defaultValue="schemeSet3">
                      <option value="schemeCategory10">Category10</option>
                      <option value="schemeAccent">Accent</option>
                      <option value="schemeDark2">Dark2</option>
                      <option value="schemePaired">Paired</option>
                      <option value="schemePastel1">Pastel1</option>
                      <option value="schemePastel2">Pastel2</option>
                      <option value="schemeSet1">Set1</option>
                      <option value="schemeSet2">Set2</option>
                      <option value="schemeSet3">Set3</option>
                      <option value="schemeTableau10">Tableau10</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Font Size Optimization</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select
                      name="sizeOptimization"
                      defaultValue="enabled"
                      onChange={(event) => {
                        setSizeOptimization(event.target.value === "enabled");
                      }}
                    >
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Rotate</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select
                      name="rotate"
                      defaultValue="30"
                      disabled={!sizeOptimization}
                    >
                      <option value="none">None</option>
                      <option value="3">Steps every 3°</option>
                      <option value="5">Steps every 5°</option>
                      <option value="10">Steps every 10°</option>
                      <option value="15">Steps every 15°</option>
                      <option value="30">Steps every 30°</option>
                      <option value="45">Steps every 45°</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="column is-4">
              <div className="field">
                <label className="label">Hyphenation</label>
                <div className="control">
                  <div className="select is-fullwidth">
                    <select
                      name="hyphenation"
                      defaultValue="disabled"
                      disabled={!sizeOptimization}
                    >
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* カスタムSVGアップロード */}
          <div className="field">
            <label className="label">Upload Custom SVG</label>
            <div className="box" style={{ backgroundColor: "#f9f9f9", borderStyle: "dashed", borderColor: "#dbdbdb" }}>
              <div className="file is-boxed is-fullwidth has-name">
                <label className="file-label" style={{ width: "100%" }}>
                  <input
                    className="file-input"
                    type="file"
                    accept=".svg"
                    onChange={async (event) => {
                      const file = event.target.files[0];
                      if (file && file.type === "image/svg+xml") {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setCustomSvgData(e.target.result);
                          setCustomSvgName(file.name);
                          // 自動的にカスタムSVGを選択
                          setTimeout(() => {
                            const customLabel = `Custom: ${file.name}`;
                            formRef.current.elements.ousideRegion.value =
                              customLabel;
                            updateRegionPreview(customLabel);
                          }, 100);
                        };
                        reader.readAsText(file);
                      } else {
                        alert("Please select an SVG file.");
                      }
                    }}
                  />
                  <span className="file-cta" style={{ width: "100%", justifyContent: "center" }}>
                    <span className="file-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="12" y1="18" x2="12" y2="12"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                      </svg>
                    </span>
                  </span>
                  {customSvgName && (
                    <span className="file-name" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
                      <span className="tag is-success">
                        <span className="icon is-small">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                        <span>{customSvgName}</span>
                      </span>
                    </span>
                  )}
                </label>
              </div>
              <p className="help has-text-centered" style={{ marginTop: "0.5rem" }}>
                Upload an SVG file to use as a custom region.
                The uploaded SVG will be automatically added to the Outside Region options.
              </p>
            </div>
          </div>

          {/* 領域プレビュー */}
          {(selectedRegionPreview || previewError) && (
            <div className="field">
              <label className="label">Region Preview</label>
              <div className="box" style={{ backgroundColor: "#f5f5f5" }}>
                {previewError ? (
                  <p className="has-text-danger">{previewError}</p>
                ) : (
                  selectedRegionPreview &&
                  (() => {
                    // 形状の境界を計算
                    const xCoords = selectedRegionPreview.map((p) => p[0]);
                    const yCoords = selectedRegionPreview.map((p) => p[1]);
                    const minX = Math.min(...xCoords);
                    const maxX = Math.max(...xCoords);
                    const minY = Math.min(...yCoords);
                    const maxY = Math.max(...yCoords);
                    const width = maxX - minX;
                    const height = maxY - minY;
                    const padding = Math.max(width, height) * 0.1; // 10%のパディング

                    const viewBoxX = minX - padding;
                    const viewBoxY = minY - padding;
                    const viewBoxWidth = width + padding * 2;
                    const viewBoxHeight = height + padding * 2;

                    return (
                      <svg
                        width="100%"
                        height="300"
                        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                          maxWidth: "500px",
                          margin: "0 auto",
                          display: "block",
                        }}
                      >
                        <path
                          d={"M" + selectedRegionPreview.join("L") + "Z"}
                          fill="none"
                          stroke="#333"
                          strokeWidth={
                            Math.max(viewBoxWidth, viewBoxHeight) * 0.005
                          }
                          strokeDasharray={`${Math.max(viewBoxWidth, viewBoxHeight) * 0.01},${Math.max(viewBoxWidth, viewBoxHeight) * 0.005}`}
                        />
                        <path
                          d={"M" + selectedRegionPreview.join("L") + "Z"}
                          fill="#e0e0e0"
                          fillOpacity="0.3"
                        />
                      </svg>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          <div className="field">
            <div className="control">
              <button
                className={`button is-dark${loading ? " is-loading" : ""}`}
                type="submit"
              >
                Summarize Text
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
};

export default NonConvexForm;
