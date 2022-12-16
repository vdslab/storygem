import { useState } from "react";
//import Form from "./component/Form";
import Select from 'react-select'
import VoronoiTreeMap from "./component/VoronoiTreeMap";
import defaultData from "./data/scVis-over149count-data.json";

import infoVisData from "./data/InfoVisData.json";
import VASTData from "./data/VASTData.json";
import scVisData from "./data/scVisData.json";

const options = [
  { value: 'scvis', label: 'scvis' },
  { value: 'infovis', label: 'infovis' },
  { value: 'vast', label: 'VAST' },
]

const dataObj = {
  "scvis": scVisData,
  "infovis": infoVisData,
  "vast": VASTData
}

const App = () => {
  const [data, setData] = useState(defaultData);
  const onChange = e => {
    setData(dataObj[e.value]);
  }
  return (
    <div className="App">
      {/*<Form setData={setData} />*/}
      <Select options={options} onChange={onChange}></Select>
      <VoronoiTreeMap data={data} />
    </div>
  );
};

export default App;
