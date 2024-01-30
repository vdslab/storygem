import { useRef, useState } from "react";
import { fonts } from "../fonts";
import { regions } from "../regions";
const Form = (props) => {
  const formRef = useRef();
  const [loading, setLoading] = useState(false);
  const [wikiUrl, setWikiUrl] = useState("https://en.wikipedia.org/wiki/Cat");

  // ランダムなWikipediaのURLを取得する関数
  const fetchRandomWikipediaUrl = async () => {
    const apiUrl =
      "https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*";
    const response = await fetch(apiUrl);
    const data = await response.json();
    const pageTitle = data.query.random[0].title;
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
  };

  // ランダムなURLをフォームにセットするイベントハンドラ
  const handleRandomClick = async () => {
    const randomUrl = await fetchRandomWikipediaUrl();
    setWikiUrl(randomUrl);
  };

  const fetchLanguageLinks = async (url) => {
    const pageTitle = url.split("/").pop();
    const lang = url.split("/")[2].split(".")[0];
    const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=${pageTitle}&lllang=en&format=json&origin=*`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId].langlinks ? pages[pageId].langlinks[0]["*"] : null;
  };

  const fetchWikipediaData = async (url) => {
    const lang = url.split("/")[2].split(".")[0];
    let pageTitle;

    if (lang === "en") {
      // 英語のページの場合、直接データを取得
      pageTitle = url.split("/").pop();
      pageTitle = decodeURIComponent(pageTitle).replace(/_/g, " ");
    } else {
      // 他の言語のページの場合、言語間リンクを通じて英語版のタイトルを取得
      pageTitle = await fetchLanguageLinks(url);
      if (!pageTitle) return null;
    }

    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&format=json&origin=*&titles=${pageTitle}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const pageId = Object.keys(data.query.pages)[0];
    return data.query.pages[pageId].extract;
  };

  return (
    <div className="container">
      <section className="section">
        <form
          ref={formRef}
          onSubmit={async (event) => {
            event.preventDefault();
            if (loading) {
              return;
            }
            setLoading(true);
            try {
              const wikiUrl = event.target.elements.wikiUrl.value;
              let wikiData;
              if (wikiUrl) {
                wikiData = await fetchWikipediaData(wikiUrl);
              }
              const text = wikiData
                ? wikiData
                : event.target.elements.text.value;
              const params = new URLSearchParams();
              params.append("words", event.target.elements.words.value);
              params.append(
                "n_neighbors",
                event.target.elements.nNeighbors.value,
              );
              params.append("lang", event.target.elements.lang.value);
              const url = `${
                import.meta.env.VITE_SERVER_URL
              }/knn_graph?${params}`;
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "text/plain",
                },
                body: text,
              });
              const data = await response.json();
              const rotate = event.target.elements.rotate.value;
              props.setData({
                data,
                outsideRegion: event.target.elements.ousideRegion.value,
                fontFamily: event.target.elements.fontFamily.value,
                rotateStep: rotate === "none" ? null : +rotate,
                allowHyphenation:
                  event.target.elements.allowHyphenation.checked,
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
          <div className="field">
            <label className="label">Wikipedia Page URL</label>
            <div className="control">
              <input
                className="input"
                name="wikiUrl"
                type="text"
                value={wikiUrl}
                onChange={(e) => setWikiUrl(e.target.value)}
                placeholder="Enter Wikipedia page URL"
              />
              <button type="button" onClick={handleRandomClick}>
                Get Random pages
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
          <div className="field">
            <label className="label">Outside Region</label>
            <div className="control">
              <div className="select is-fullwidth">
                <select name="ousideRegion" defaultValue={regions[0]}>
                  {regions.map((region) => {
                    return (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
          <div className="field">
            <label className="label">Rotate</label>
            <div className="control">
              <div className="select is-fullwidth">
                <select name="rotate" defaultValue="30">
                  <option value="none">None</option>
                  <option value="10">Steps every 10°</option>
                  <option value="15">Steps every 15°</option>
                  <option value="30">Steps every 30°</option>
                  <option value="45">Steps every 45°</option>
                </select>
              </div>
            </div>
          </div>
          <div className="field">
            <label className="label">Font Family</label>
            <div className="control">
              <div className="select is-fullwidth">
                <select name="fontFamily" defaultValue={fonts[0]}>
                  {fonts.map((font) => {
                    return (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
          <div className="field">
            <div className="control">
              <label className="checkbox">
                <input type="checkbox" name="allowHyphenation" /> Allow
                hyphenation
              </label>
            </div>
          </div>
          <div className="field is-grouped">
            <div className="control">
              <div className="file">
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

export default Form;
