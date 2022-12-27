import { useRef, useState } from "react";
//https://www.japantimes.co.jp/news/2022/11/28/national/english-speaking-test/ のニュース
const defaultText =
  "The Tokyo Metropolitan Board of Education on Sunday held its first English speaking test, part of the entrance examinations for metropolitan high schools. About 69,000 applicants, mainly students of public junior high schools in the capital, took the test, introduced in hopes of developing globally competitive human resources. At Hibiya High School, one of the 197 test sites, seemingly nervous junior high school third-year students were entering the building. In the 15-minute test, examinees spoke into a microphone to answer questions displayed on a tablet device. The number of applicants reached 76,000 for only students of public junior high schools, but many of them were absent or arrived late. The education board plans to hold a makeup test Dec. 18. There have been no reports of major problems, such as equipment failure, according to the board. The test was administered by educational service provider Benesse. About 670 employees of the education board were dispatched to exam sites. The results will be disclosed to exam takers online on Jan. 12. Tokyo is the first local government that has uniformly introduced an English test administered by a private organization to local public high school entrance examinations. The English speaking test has drawn opposition partly because it excludes students of national and private junior high schools. Critics also say that the grading method is not fair or transparent. Some residents have filed a lawsuit to stop public funds from being spent on the test.";

const Form = (props) => {
  const formRef = useRef();
  const [loading, setLoading] = useState(false);
  return (
    <section className="section">
      <div className="container">
        <form
          ref={formRef}
          onSubmit={async (event) => {
            event.preventDefault();
            if (loading) {
              return;
            }
            setLoading(true);
            const text = event.target.elements.text.value;
            const params = new URLSearchParams();
            params.append("words", event.target.elements.words.value);
            params.append(
              "n_neighbors",
              event.target.elements.nNeighbors.value,
            );
            const url = `${process.env.REACT_APP_SERVER_URL}/knn_graph?${params}`;
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain",
              },
              body: text,
            });
            const data = await response.json();
            props.setData(data);
            setLoading(false);
          }}
        >
          <div className="field">
            <label className="label">Input Text</label>
            <div className="control">
              <textarea
                name="text"
                className="textarea"
                defaultValue={defaultText}
              />
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
      </div>
    </section>
  );
};

export default Form;
