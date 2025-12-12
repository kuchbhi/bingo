import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const [playerCount, setPlayerCount] = useState(1);
    const navigate = useNavigate();

    useEffect(() => {
        // Announce welcome and ask for players
        const speak = (text) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        };

        // Small delay to allow interaction (browsers block auto-audio)
        // We'll add a button to start interaction if needed, or just try.
        // Usually requires user gesture.
    }, []);

    const handleStart = () => {
        // In a real app, we might create a game session on the backend here.
        // For now, we just navigate to Master with the state.
        navigate('/master', { state: { playerCount } });
    };

    const playWelcome = () => {
        const utterance = new SpeechSynthesisUtterance("Welcome to American Bingo! How many players will be joining us today?");
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    }

    return (
        <div className="home-container">
            <h1>American Bingo</h1>
            <button onClick={playWelcome} className="speak-btn">🔊 Start Voice</button>

            <div className="input-group">
                <label>How many players?</label>
                <input
                    type="number"
                    min="1"
                    value={playerCount}
                    onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                />
            </div>

            <button onClick={handleStart} className="start-btn">Start Game</button>
        </div>
    );
};

export default Home;
