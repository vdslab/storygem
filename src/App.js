import { useState } from "react";
import Form from "./component/Form";
import VoronoiTreeMap from "./component/VoronoiTreeMap";

const App = () => {
  const [data, setData] = useState(null);
  return (
    <div className="App">
      <Form setData={setData} />
      {data && <VoronoiTreeMap data={data} />}
    </div>
  );
};

export default App;
