import "bulma/css/bulma.css";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { fonts, fontSize } from "./fonts";

const link = document.createElement("link");
const params = new URLSearchParams();
for (const font of fonts) {
  params.append("family", font.query);
}
params.append("display", "swap");
link.href = `https://fonts.googleapis.com/css2?${params}`;
link.rel = "stylesheet";
document.head.append(link);

Promise.all(
  fonts.map((font) => document.fonts.load(`${fontSize}px ${font.name}`)),
).then(() => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
