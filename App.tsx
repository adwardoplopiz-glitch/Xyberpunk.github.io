import React from 'react';
import HudInterface from './components/HudInterface';

const App: React.FC = () => {
  return (
    <div className="w-full h-screen bg-black overflow-hidden">
        <HudInterface />
    </div>
  );
};

export default App;