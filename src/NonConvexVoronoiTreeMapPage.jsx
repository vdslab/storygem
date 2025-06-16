import { useState } from "react";
import NonConvexForm from "./component/NonConvexForm";
import NonConvexVoronoiTreeMap from "./component/NonConvexVoronoiTreeMap";

const NonConvexVoronoiTreeMapPage = () => {
  const [data, setData] = useState(null);
  const [showTextPolygon, setShowTextPolygon] = useState(false);
  const [showConvexHull, setShowConvexHull] = useState(false);

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
      <div className="container">
        <section className="section">
          <div className="field">
            <div className="control">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showTextPolygon}
                  onChange={(e) => setShowTextPolygon(e.target.checked)}
                />
                テキスト領域を表示
              </label>
            </div>
          </div>
          <div className="field">
            <div className="control">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showConvexHull}
                  onChange={(e) => setShowConvexHull(e.target.checked)}
                />
                凸包を表示
              </label>
            </div>
          </div>
        </section>
      </div>
      <NonConvexVoronoiTreeMap 
        data={data} 
        showTextPolygon={showTextPolygon} 
        showConvexHull={showConvexHull}
      />
    </div>
  );
};

export default NonConvexVoronoiTreeMapPage;
