import VoronoiTreeMap from './component/VoronoiTreeMap'

const App = () => {
  return (
    <div className="App">
      <VoronoiTreeMap
        margin={{ top: 40, right: 10, bottom: 10, left: 10 }}
        radius={150}
        weightAccessor={(d) => d.asd}
        colorAccessor={(d) => "steelblue"}
        labelAccessor={(d) => d.asd.toString()}
        dataset={[
          { asd: 1 },
          { asd: 2 },
          { asd: 3 },
          { asd: 4 },
          { asd: 5 },
          { asd: 6 },
          { asd: 7 },
          { asd: 8 },
          { asd: 9 },
          { asd: 10 },
          { asd: 11 },
          { asd: 12 },
          { asd: 13 },
          { asd: 14 }
        ]}
      />
    </div>
  );
}

export default App;
