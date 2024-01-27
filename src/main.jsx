import "bulma/css/bulma.css";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { fonts, fontSize } from "./fonts";

Promise.all(
  fonts.map((font) => document.fonts.load(`${fontSize}px ${font}`))
).then(() => {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
