import { useState } from "react";
import Form from "./component/Form";
import VoronoiTreeMap from "./component/VoronoiTreeMap";

const App = () => {
  const [data, setData] = useState(null);
  const [language, setLanguage] = useState("en");
  const params = new URLSearchParams(location.search);
  return (
    <div className="App">
      <Form setData={setData} setLanguage={setLanguage} />
      {data && (
        <VoronoiTreeMap
          data={data}
          language={language}
          showTextPolygon={params.has("debug")}
        />
      )}
    </div>
  );
};

export default App;
