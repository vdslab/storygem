import { useEffect, useRef, useState } from "react";
import { fonts, defaultFont, fontSize } from "../fonts";
import { regions } from "../regions";
import NonConvexWorker from "../worker/nonconvex-worker?worker";

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

  const nonConvexRegions = regions.filter((region) => !region.isConvex);

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

              const outsideRegion = nonConvexRegions.find(
                ({ label }) =>
                  label === event.target.elements.ousideRegion.value,
              ).points;
              const fontFamily = event.target.elements.fontFamily.value;

              for (const item of data) {
                if (item.word) {
                  item.textMeasure = textMeasure(item.word, fontFamily);
                }
              }

              console.log("NonConvexForm - sending to worker:", {
                dataLength: data.length,
                outsideRegionLength: outsideRegion.length,
                fontFamily,
                colorPalette: event.target.elements.colorPalette.value,
              });

              const result = await layoutNonConvexVoronoiTreeMap({
                data,
                outsideRegion,
                fontFamily,
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
                    >
                      {nonConvexRegions.map((region) => {
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
          </div>
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
