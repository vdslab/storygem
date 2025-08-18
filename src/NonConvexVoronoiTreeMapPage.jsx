import { useState } from "react";
import NonConvexForm from "./component/NonConvexForm";
import NonConvexVoronoiTreeMap from "./component/NonConvexVoronoiTreeMap";

const NonConvexVoronoiTreeMapPage = () => {
  const [data, setData] = useState(null);

  return (
    <div>
      <div className="navbar is-light">
        <div className="navbar-brand">
          <div className="navbar-item">
            <h1 className="title is-4">StoryGem</h1>
          </div>
        </div>
        <div className="navbar-menu">
          <div className="navbar-start">
            <a href="/" className="navbar-item">
              Home
            </a>
            <a href="/nonconvex-voronoi-treemap" className="navbar-item is-active">
              非凸領域のVoronoi Treemap
            </a>
          </div>
        </div>
      </div>
      <NonConvexForm setData={setData} />
      <NonConvexVoronoiTreeMap data={data} />
    </div>
  );
};

export default NonConvexVoronoiTreeMapPage;
