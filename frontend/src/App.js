import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Simulation from "@/pages/Simulation";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Simulation />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
