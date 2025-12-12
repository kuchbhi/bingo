import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Master from './pages/Master';
import Player from './pages/Player';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/master" element={<Master />} />
        <Route path="/player" element={<Player />} />
        <Route path="/player/:id" element={<Player />} />
      </Routes>
    </Router>
  );
}

export default App;
