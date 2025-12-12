import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './Player.css';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Player = () => {
    const [playerName, setPlayerName] = useState('');
    const [isNameSet, setIsNameSet] = useState(false);
    const [card, setCard] = useState([]);
    const [marked, setMarked] = useState(new Array(25).fill(false));
    const [winningRows, setWinningRows] = useState([]);
    const [winningDiagonals, setWinningDiagonals] = useState([]);
    const [isFullBingo, setIsFullBingo] = useState(false);

    // --- New State for Session Authorization ---
    const [isSessionActive, setIsSessionActive] = useState(false);
    // -------------------------------------------

    // Track reported wins to avoid duplicate events
    const reportedWins = useRef(new Set());
    const socketRef = useRef(null);

    const [calledNumbers, setCalledNumbers] = useState([]);
    const [shakeIndex, setShakeIndex] = useState(null);

    useEffect(() => {
        // Connect to socket
        socketRef.current = io(API_URL);

        socketRef.current.on('number_drawn', (data) => {
            setCalledNumbers(prev => [...prev, data.number]);
        });

        // --- New Socket Listener for Session Status ---
        socketRef.current.on('session_status', (data) => {
            if (data.status === 'started') {
                console.log("Game session has started!");
                setIsSessionActive(true);
            } else {
                console.log("Waiting for Master to authorize game session...");
                setIsSessionActive(false);
            }
        });
        // -------------------------------------------

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        if (isNameSet) {
            generateCard();
        }
    }, [isNameSet]);

    const handleNameSubmit = (e) => {
        e.preventDefault();
        if (playerName.trim()) {
            setIsNameSet(true);
        }
    };

    const generateCard = () => {
        // Generate 24 random unique numbers 1-90
        const nums = new Set();
        while (nums.size < 24) {
            nums.add(Math.floor(Math.random() * 90) + 1);
        }

        // Sort numerically for row-wise increasing order
        const sortedNums = Array.from(nums).sort((a, b) => a - b);

        // Insert FREE space at index 12
        sortedNums.splice(12, 0, 'FREE');

        setCard(sortedNums);

        // Initialize marked state (FREE is always marked)
        const initialMarked = new Array(25).fill(false);
        initialMarked[12] = true;
        setMarked(initialMarked);
    };

    const toggleMark = (index) => {
        // --- Game Action Protection ---
        if (!isSessionActive) {
            console.log("Cannot mark: Game has not started yet.");
            // Optionally trigger a visual cue or toast notification here
            return;
        }
        // ------------------------------

        if (index === 12) return; // Cannot toggle FREE space

        const number = card[index];

        // Cheat check: Allow unmarking, but only allow marking if number has been called
        if (!marked[index] && !calledNumbers.includes(number)) {
            // Trigger shake animation
            setShakeIndex(index);
            setTimeout(() => setShakeIndex(null), 500);
            return;
        }

        const newMarked = [...marked];
        newMarked[index] = !newMarked[index];
        setMarked(newMarked);
        checkWin(newMarked);
    };

    const checkWin = (currentMarked) => {
        // ... (Win checking logic remains the same) ...

        const rows = [];
        const diagonals = [];
        const size = 5;
        let newWinType = null;

        // Check Rows
        for (let i = 0; i < size; i++) {
            const rowIndices = [];
            let isRowComplete = true;
            for (let j = 0; j < size; j++) {
                const index = i * size + j;
                rowIndices.push(index);
                if (!currentMarked[index]) {
                    isRowComplete = false;
                    break;
                }
            }
            if (isRowComplete) {
                rows.push(...rowIndices);
                const winId = `row-${i}`;
                if (!reportedWins.current.has(winId)) {
                    reportedWins.current.add(winId);
                    newWinType = 'Row Completed';
                }
            }
        }

        // Check Diagonals
        // Main Diagonal (0, 6, 12, 18, 24)
        const mainDiagIndices = [0, 6, 12, 18, 24];
        if (mainDiagIndices.every(i => currentMarked[i])) {
            diagonals.push(...mainDiagIndices);
            const winId = 'diag-main';
            if (!reportedWins.current.has(winId)) {
                reportedWins.current.add(winId);
                newWinType = 'Diagonal Completed';
            }
        }

        // Anti Diagonal (4, 8, 12, 16, 20)
        const antiDiagIndices = [4, 8, 12, 16, 20];
        if (antiDiagIndices.every(i => currentMarked[i])) {
            diagonals.push(...antiDiagIndices);
            const winId = 'diag-anti';
            if (!reportedWins.current.has(winId)) {
                reportedWins.current.add(winId);
                newWinType = 'Diagonal Completed';
            }
        }

        // Check Full Bingo (all numbers marked)
        const allMarked = currentMarked.every(m => m);
        if (allMarked) {
            setIsFullBingo(true);
            const winId = 'full-bingo';
            if (!reportedWins.current.has(winId)) {
                reportedWins.current.add(winId);
                newWinType = 'FULL BINGO!';
            }
        }

        setWinningRows(rows);
        setWinningDiagonals(diagonals);

        // Emit event if new win
        if (newWinType && socketRef.current && isNameSet) {
            // Note: The backend will now check 'isSessionActive' before processing this event
            socketRef.current.emit('player_win', {
                name: playerName,
                type: newWinType
            });
        }
    };

    if (!isNameSet) {
        return (
            <div className="player-container name-entry">
                <h1>Welcome to Bingo!</h1>
                <p>{isSessionActive ? "Game session is active!" : "Waiting for Master to start the game..."}</p>
                <form onSubmit={handleNameSubmit}>
                    <input
                        type="text"
                        placeholder="Enter your name"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="name-input"
                        autoFocus
                    />
                    {/* Allow joining regardless of session status, but block card interaction later */}
                    <button type="submit" className="start-btn">Join Game</button>
                </form>
            </div>
        );
    }

    // Display status message if name is set but session isn't active
    if (!isSessionActive) {
        return (
            <div className="player-container waiting-session">
                <div className="player-header">
                    <h1>{playerName}'s Card</h1>
                </div>
                <div className="waiting-message">
                    <p>Your card is ready, but the **Bingo Master** must authorize the game session before you can start marking numbers.</p>
                    <p>Waiting for the Master's Secret ID...</p>
                </div>
                {/* Optionally show the card here, but disabled */}
                <div className="bingo-grid disabled-grid">
                    {/* Render card as disabled visual */}
                </div>
            </div>
        );
    }


    return (
        <div className={`player-container ${isFullBingo ? 'full-bingo' : ''}`}>
            <div className="player-header">
                <h1>{playerName}'s Card</h1>
                {isFullBingo && <div className="bingo-banner">BINGO!</div>}
            </div>

            <div className="bingo-grid">
                {card.map((num, i) => {
                    const isRowWin = winningRows.includes(i);
                    const isDiagWin = winningDiagonals.includes(i);

                    return (
                        <div
                            key={i}
                            className={`grid-cell
                                ${marked[i] ? 'marked' : ''}
                                ${num === 'FREE' ? 'free-space' : ''}
                                ${isRowWin ? 'winning-row' : ''}
                                ${isDiagWin ? 'winning-diagonal' : ''}
                                ${shakeIndex === i ? 'shake' : ''}
                            `}
                            onClick={() => toggleMark(i)}
                        >
                            {num}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Player;