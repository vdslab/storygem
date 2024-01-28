import { useState } from "react";
import Form from "./component/Form";
import VoronoiTreeMap from "./component/VoronoiTreeMap";

const App = () => {
  const [data, setData] = useState(null);
  return (
    <div className="App">
      <Form setData={setData} />
      {data && (
        <VoronoiTreeMap
          data={data.data}
          outsideRegion={data.outsideRegion}
          fontFamily={data.fontFamily}
          rotateStep={data.rotateStep}
          allowHyphenation={data.allowHyphenation}
        />
      )}
    </div>
  );
};

export default App;