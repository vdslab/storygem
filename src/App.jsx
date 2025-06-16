import { useState } from "react";
import Form from "./component/Form";
import VoronoiTreeMap from "./component/VoronoiTreeMap";

const App = () => {
  const [data, setData] = useState(null);
  const params = new URLSearchParams(location.search);
  return (
    <div className="App">
      <div className="navbar is-light">
        <div className="navbar-brand">
          <div className="navbar-item">
            <h1 className="title is-4">StoryGem</h1>
          </div>
        </div>
        <div className="navbar-menu">
          <div className="navbar-start">
            <a href="/" className="navbar-item is-active">
              Home
            </a>
            <a href="/nonconvex-voronoi-treemap" className="navbar-item">
              非凸領域のVoronoi Treemap
            </a>
          </div>
        </div>
      </div>
      <Form setData={setData} />
      {data && (
        <VoronoiTreeMap data={data} showTextPolygon={params.has("debug")} />
      )}
    </div>
  );
};

export default App;
