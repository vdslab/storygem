import React, { useState } from "react";
import NonConvexForm from "./component/NonConvexForm";
import NonConvexVoronoiTreeMap from "./component/NonConvexVoronoiTreeMap";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <section className="section">
            <div className="notification is-danger">
              <p className="title is-5">描画エラーが発生しました</p>
              <p className="subtitle is-6" style={{ wordBreak: "break-all" }}>
                {this.state.error?.message || "Unknown error"}
              </p>
              <button
                className="button is-light is-small"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onReset?.();
                }}
              >
                クリアして再試行
              </button>
            </div>
          </section>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <ErrorBoundary onReset={() => setData(null)}>
        <NonConvexVoronoiTreeMap data={data} />
      </ErrorBoundary>
    </div>
  );
};

export default NonConvexVoronoiTreeMapPage;
