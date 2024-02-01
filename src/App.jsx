import { useState } from "react";
import Form from "./component/Form";
import VoronoiTreeMap from "./component/VoronoiTreeMap";

const App = () => {
  const [data, setData] = useState(null);
  const params = new URLSearchParams(location.search);
  return (
    <div className="App">
      <Form setData={setData} />
      {data && (
        <VoronoiTreeMap data={data} showTextPolygon={params.has("debug")} />
      )}
    </div>
  );
};

export default App;
