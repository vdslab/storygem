import { useState } from "react";
import Form from "./component/Form";
import VoronoiTreeMap from "./component/VoronoiTreeMap";
import defaultData from "./data/data.json";

const App = () => {
  const [data, setData] = useState(defaultData);
  return (
    <div className="App">
      <Form setData={setData} />
      <VoronoiTreeMap data={data} />
    </div>
  );
};

export default App;
