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
  return new Promise((resolve, reject) => {
    const worker = new NonConvexWorker();
    worker.onmessage = (event) => {
      if (event.data?.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };
    worker.onerror = (event) => {
      reject(new Error(event.message || "Worker error"));
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
  const [errorMessage, setErrorMessage] = useState(null);
  const [sizeOptimization, setSizeOptimization] = useState(true);
  const [customSvgData, setCustomSvgData] = useState(null);
  const [customSvgName, setCustomSvgName] = useState("");
  const [customPngData, setCustomPngData] = useState(null);
  const [customPngName, setCustomPngName] = useState("");
  const [selectedRegionPreview, setSelectedRegionPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [layoutMode, setLayoutMode] = useState("dropdown"); // "dropdown" or "horizontal"
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [excludeWords, setExcludeWords] = useState("");
  const [useInitialPositions, setUseInitialPositions] = useState(true);

  const nonConvexRegions = regions.filter((region) => !region.isConvex);

  // カスタムSVGまたはPNGがある場合は選択肢に追加
  let allRegions = [...nonConvexRegions];
  if (customSvgData) {
    allRegions.push({ label: `Custom SVG: ${customSvgName}`, isCustom: true, type: "svg" });
  }
  if (customPngData) {
    allRegions.push({ label: `Custom PNG: ${customPngName}`, isCustom: true, type: "png" });
  }

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

      if (selectedRegion.isCustom) {
        if (selectedRegion.type === "svg" && customSvgData) {
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
                /translate\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)/,
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

            // SVGファイルはそのままの座標系を使用
            previewPoints = simplifyPoints(points, 0.5);
          }
        } else if (selectedRegion.type === "png" && customPngData) {
          const { extractContourFromPNG } = await import(
            "../utils/pngContourExtractor"
          );
          const scale = 1.5;
          const offsetX = 500;
          const offsetY = 500;

          previewPoints = await extractContourFromPNG(
            customPngData,
            scale,
            offsetX,
            offsetY,
            128 // アルファ閾値
          );
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
      const firstRegion = nonConvexRegions[0];
      setSelectedRegion(firstRegion.label);
      updateRegionPreview(firstRegion.label);
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
            setErrorMessage(null);
            try {
              // 除外単語の処理
              let processedText = event.target.elements.text.value;
              const excludeWordsValue = event.target.elements.excludeWords.value.trim();
              
              if (excludeWordsValue) {
                // カンマまたはスペースで区切られた単語を配列に変換
                const wordsToExclude = excludeWordsValue
                  .split(/[,\s]+/)
                  .map(word => word.trim())
                  .filter(word => word.length > 0);
                
                // 各除外単語をテキストから削除
                wordsToExclude.forEach(word => {
                  // 単語境界を考慮した正規表現で置換
                  const regex = new RegExp(`\\b${word}\\b`, "gi");
                  processedText = processedText.replace(regex, "");
                });
                
                // 連続する空白を1つの空白に置換
                processedText = processedText.replace(/\s+/g, " ").trim();
              }

              const data = await fetchGraph({
                text: processedText,
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
              if (selectedRegion.isCustom) {
                try {
                  if (selectedRegion.type === "svg" && customSvgData) {
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
                          /translate\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)/,
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

                      // SVGファイルはそのままの座標系を使用
                      outsideRegion = simplifyPoints(points, 0.5);
                    } else {
                      throw new Error("No path element found in custom SVG");
                    }
                  } else if (selectedRegion.type === "png" && customPngData) {
                    const { extractContourFromPNG } = await import(
                      "../utils/pngContourExtractor"
                    );
                    const scale = 1.5;
                    const offsetX = 500;
                    const offsetY = 500;

                    outsideRegion = await extractContourFromPNG(
                      customPngData,
                      scale,
                      offsetX,
                      offsetY,
                      128 // アルファ閾値
                    );
                  }
                } catch (error) {
                  console.error("Failed to parse custom file:", error);
                  alert(
                    "Failed to parse custom file. Please select a valid file.",
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
                useInitialPositions,
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
              setErrorMessage(e.message || "エラーが発生しました。もう一度お試しください。");
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
          <div className="field">
            <label className="label">除外する単語</label>
            <div className="control">
              <input
                className="input"
                name="excludeWords"
                type="text"
                placeholder="例: the, and, of (カンマまたはスペース区切り)"
                value={excludeWords}
                onChange={(e) => setExcludeWords(e.target.value)}
              />
            </div>
            <p className="help">
              出力結果から除外したい単語を入力してください。カンマまたはスペースで区切って複数指定できます。
            </p>
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
                <label className="label">
                  Outside Region (非凸領域)
                  <button
                    type="button"
                    className="button is-small is-light is-pulled-right"
                    onClick={() => setLayoutMode(layoutMode === "dropdown" ? "horizontal" : "dropdown")}
                    style={{ marginLeft: "10px" }}
                  >
                    {layoutMode === "dropdown" ? "横長レイアウト" : "ドロップダウン"}
                  </button>
                </label>
                {layoutMode === "dropdown" ? (
                  <div className="control">
                    <div className="select is-fullwidth">
                      <select
                        name="ousideRegion"
                        value={selectedRegion || nonConvexRegions[0]?.label}
                        onChange={(e) => {
                          setSelectedRegion(e.target.value);
                          updateRegionPreview(e.target.value);
                        }}
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
                ) : (
                  <input type="hidden" name="ousideRegion" value={selectedRegion || nonConvexRegions[0]?.label} />
                )}
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
            <div className="column is-12">
              <div className="field">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={useInitialPositions}
                    onChange={(e) => setUseInitialPositions(e.target.checked)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  スプリングレイアウトの初期位置を使用
                </label>
                <p className="help">
                  単語間の意味的距離がレイアウトに反映されます
                </p>
              </div>
            </div>
          </div>

          {/* 横長レイアウトの領域選択 */}
          {layoutMode === "horizontal" && (
            <div className="field">
              <label className="label">Select Region Shape</label>
              <div className="box" style={{ backgroundColor: "#f9f9f9", padding: "1.5rem" }}>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1rem"
                }}>
                  {allRegions.map((region) => {
                    const isSelected = selectedRegion === region.label;
                    return (
                      <div
                        key={region.label}
                        onClick={() => {
                          setSelectedRegion(region.label);
                          updateRegionPreview(region.label);
                        }}
                        style={{
                          cursor: "pointer",
                          border: isSelected ? "3px solid #3273dc" : "2px solid #dbdbdb",
                          borderRadius: "8px",
                          padding: "1rem",
                          backgroundColor: isSelected ? "#f0f7ff" : "white",
                          transition: "all 0.2s ease",
                          textAlign: "center",
                          minHeight: "120px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = "#3273dc";
                            e.currentTarget.style.backgroundColor = "#fafafa";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = "#dbdbdb";
                            e.currentTarget.style.backgroundColor = "white";
                          }
                        }}
                      >
                        {/* 簡易的な形状プレビュー */}
                        <div style={{ marginBottom: "0.5rem" }}>
                          {(() => {
                            // 各形状に対応するシンプルなSVGアイコンを表示
                            const iconSize = 50;
                            const strokeColor = isSelected ? "#3273dc" : "#666";
                            
                            if (region.label === "L Shape") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M20 20 L20 80 L50 80 L50 50 L80 50 L80 20 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.label === "Star Shape") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M50 15 L60 40 L85 40 L65 55 L75 80 L50 65 L25 80 L35 55 L15 40 L40 40 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.label === "Cross Shape") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M35 20 L65 20 L65 35 L80 35 L80 65 L65 65 L65 80 L35 80 L35 65 L20 65 L20 35 L35 35 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.label === "Heart Shape") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M50 25 C30 10, 10 25, 25 45 L50 75 L75 45 C90 25, 70 10, 50 25 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.label === "Horizontal T Shape") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M10 30 L90 30 L90 50 L60 50 L60 80 L40 80 L40 50 L10 50 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.label === "Horizontal U Shape") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M20 30 L20 70 L35 70 L35 45 L65 45 L65 70 L80 70 L80 30 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.label === "Horizontal Steps") {
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <path d="M20 30 L40 30 L40 45 L60 45 L60 60 L80 60 L80 75 L20 75 Z" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            } else if (region.isCustom) {
                              // カスタムファイルのアイコン
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <rect x="20" y="15" width="60" height="70" rx="5" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                  <polyline points="60,15 60,30 80,30" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                  {region.type === "png" && (
                                    <circle cx="40" cy="50" r="5" fill={strokeColor}/>
                                  )}
                                  <text x="50" y="65" textAnchor="middle" fontSize="14" fill={strokeColor}>
                                    {region.type?.toUpperCase()}
                                  </text>
                                </svg>
                              );
                            } else {
                              // デフォルトの四角形
                              return (
                                <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
                                  <rect x="25" y="25" width="50" height="50" 
                                    fill="none" stroke={strokeColor} strokeWidth="3"/>
                                </svg>
                              );
                            }
                          })()}
                        </div>
                        <div style={{ 
                          fontSize: "0.875rem",
                          fontWeight: isSelected ? "600" : "400",
                          color: isSelected ? "#3273dc" : "#4a4a4a",
                          wordBreak: "break-word",
                          lineHeight: "1.2"
                        }}>
                          {region.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="help has-text-centered">
                  Click on a shape to select it as the outside region for the Voronoi Treemap
                </p>
              </div>
            </div>
          )}

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
                            const customLabel = `Custom SVG: ${file.name}`;
                            setSelectedRegion(customLabel);
                            if (layoutMode === "dropdown") {
                              formRef.current.elements.ousideRegion.value = customLabel;
                            }
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

          {/* カスタムPNGアップロード */}
          <div className="field">
            <label className="label">Upload Custom PNG (Transparent Background)</label>
            <div className="box" style={{ backgroundColor: "#f9f9f9", borderStyle: "dashed", borderColor: "#dbdbdb" }}>
              <div className="file is-boxed is-fullwidth has-name">
                <label className="file-label" style={{ width: "100%" }}>
                  <input
                    className="file-input"
                    type="file"
                    accept=".png"
                    onChange={async (event) => {
                      const file = event.target.files[0];
                      if (file && file.type === "image/png") {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setCustomPngData(e.target.result);
                          setCustomPngName(file.name);
                          // 自動的にカスタムPNGを選択
                          setTimeout(() => {
                            const customLabel = `Custom PNG: ${file.name}`;
                            setSelectedRegion(customLabel);
                            if (layoutMode === "dropdown") {
                              formRef.current.elements.ousideRegion.value = customLabel;
                            }
                            updateRegionPreview(customLabel);
                          }, 100);
                        };
                        reader.readAsDataURL(file);
                      } else {
                        alert("Please select a PNG file.");
                      }
                    }}
                  />
                  <span className="file-cta" style={{ width: "100%", justifyContent: "center" }}>
                    <span className="file-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </span>
                    <span className="file-label">
                      Drag & drop or click to select PNG file
                    </span>
                  </span>
                  {customPngName && (
                    <span className="file-name" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
                      <span className="tag is-success">
                        <span className="icon is-small">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </span>
                        <span>{customPngName}</span>
                      </span>
                    </span>
                  )}
                </label>
              </div>
              <p className="help has-text-centered" style={{ marginTop: "0.5rem" }}>
                Upload a PNG file with transparent background to use as a custom region.
                The non-transparent area will be extracted as the region boundary.
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
                  selectedRegionPreview.length > 0 &&
                  (() => {
                    // 有効な座標のみをフィルタリング
                    const validPoints = selectedRegionPreview.filter(
                      p => Array.isArray(p) && 
                           p.length >= 2 && 
                           !isNaN(p[0]) && 
                           !isNaN(p[1]) &&
                           isFinite(p[0]) &&
                           isFinite(p[1])
                    );
                    
                    if (validPoints.length < 3) {
                      return <p className="has-text-warning">Not enough valid points to display preview</p>;
                    }
                    
                    // 形状の境界を計算
                    const xCoords = validPoints.map((p) => p[0]);
                    const yCoords = validPoints.map((p) => p[1]);
                    const minX = Math.min(...xCoords);
                    const maxX = Math.max(...xCoords);
                    const minY = Math.min(...yCoords);
                    const maxY = Math.max(...yCoords);
                    const width = maxX - minX;
                    const height = maxY - minY;
                    
                    // 幅または高さが0の場合のフォールバック
                    const effectiveWidth = width > 0 ? width : 100;
                    const effectiveHeight = height > 0 ? height : 100;
                    const padding = Math.max(effectiveWidth, effectiveHeight) * 0.1; // 10%のパディング

                    const viewBoxX = minX - padding;
                    const viewBoxY = minY - padding;
                    const viewBoxWidth = effectiveWidth + padding * 2;
                    const viewBoxHeight = effectiveHeight + padding * 2;

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
                          d={"M" + validPoints.map(p => `${p[0]},${p[1]}`).join("L") + "Z"}
                          fill="none"
                          stroke="#333"
                          strokeWidth={
                            Math.max(viewBoxWidth, viewBoxHeight) * 0.005
                          }
                          strokeDasharray={`${Math.max(viewBoxWidth, viewBoxHeight) * 0.01},${Math.max(viewBoxWidth, viewBoxHeight) * 0.005}`}
                        />
                        <path
                          d={"M" + validPoints.map(p => `${p[0]},${p[1]}`).join("L") + "Z"}
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
          {errorMessage && (
            <div className="notification is-danger is-light">
              <button className="delete" onClick={() => setErrorMessage(null)} />
              <strong>エラー:</strong> {errorMessage}
            </div>
          )}
        </form>
      </section>
    </div>
  );
};

export default NonConvexForm;
