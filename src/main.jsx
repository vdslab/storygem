import "bulma/css/bulma.css";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { fonts, fontSize } from "./fonts";

const link = document.createElement("link");
const params = [];
for (const font of fonts) {
  if (font.query) {
    params.push(`family=${font.query}`);
  }
}
params.push("display=swap");
link.href = `https://fonts.googleapis.com/css2?${params.join("&")}`;
link.rel = "stylesheet";
link.addEventListener("load", () => {
  Promise.all(
    fonts.map((font) => document.fonts.load(`${fontSize}px ${font.name}`)),
  ).then((result) => {
    console.log(result);
    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
});
document.head.append(link);
