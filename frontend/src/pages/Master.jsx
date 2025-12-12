import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { io } from 'socket.io-client';
import './Master.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Master = () => {
    const location = useLocation();
    const playerCount = location.state?.playerCount || 1;

    // --- New State for Authorization ---
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [secretIdInput, setSecretIdInput] = useState('');
    const [authError, setAuthError] = useState('');
    // -----------------------------------

    const [drawnNumbers, setDrawnNumbers] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(null);
    const [gameUrl, setGameUrl] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [winners, setWinners] = useState([]);

    // Use ref for socket to avoid re-renders
    const socketRef = useRef(null);

    const phrases = [
        "Next is",
        "Coming up",
        "Ready for",
        "We have",
        "Look for",
        "Here is",
        "" // Sometimes just say the number
    ];

    useEffect(() => {
        const host = window.location.host;
        // Assuming the player path is relative to the current location
        setGameUrl(`${window.location.protocol}//${host}/player`);

        // Connect to socket
        socketRef.current = io(API_URL);

        socketRef.current.on('bingo_win', (data) => {
            // Add new winner to top of list
            setWinners(prev => [{ ...data, time: new Date().toLocaleTimeString() }, ...prev]);

            // Celebration confetti for full bingo
            if (data.type.includes('FULL')) {
                triggerConfetti();
            }
        });

        // Listen for session status updates from the backend
        socketRef.current.on('session_status', (data) => {
            if (data.status === 'started') {
                setIsAuthorized(true);
            } else if (data.status === 'pending') {
                setIsAuthorized(false);
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Countdown timer effect
    useEffect(() => {
        // Only run the countdown if authorized
        if (!isAuthorized) return;

        if (isPaused || isSpeaking || drawnNumbers.length === 0 || drawnNumbers.length >= 90) return;

        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            // Add random delay before drawing (1s to 1.5s)
            const randomDelay = Math.floor(Math.random() * 500) + 1000;
            const delayTimer = setTimeout(() => {
                drawNumber();
            }, randomDelay);
            return () => clearTimeout(delayTimer);
        }
    }, [countdown, isPaused, isSpeaking, drawnNumbers, isAuthorized]); // Dependency on isAuthorized

    // Reset countdown when speaking finishes
    useEffect(() => {
        if (!isSpeaking && drawnNumbers.length > 0) {
            setCountdown(3);
        }
    }, [isSpeaking]);

    // --- New Authorization Logic ---
    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError(''); // Clear previous errors

        try {
            const response = await fetch(`${API_URL}/start_session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    secret_id: secretIdInput
                })
            });

            if (response.ok) {
                // Backend will set session_started = true and emit a socket event.
                // The socket listener above will catch the 'session_status: started' and set isAuthorized(true).
                console.log("Session authorized successfully!");
                // Clear the input and error state on success
                setSecretIdInput('');
                setAuthError('');
            } else {
                const errorData = await response.json();
                setAuthError(`Authentication failed: ${errorData.detail || 'Invalid ID.'}`);
            }
        } catch (error) {
            console.error('Network or server error:', error);
            setAuthError('Could not connect to the Bingo server.');
        }
    };
    // -----------------------------------

    const drawNumber = async () => {
        if (!isAuthorized) return; // Block draw if not authorized
        if (drawnNumbers.length >= 90) return;
        if (isSpeaking) return;

        // Generate random number 1-90 that hasn't been drawn
        let num;
        do {
            num = Math.floor(Math.random() * 90) + 1;
        } while (drawnNumbers.includes(num));

        setDrawnNumbers(prev => [...prev, num]);
        setCurrentNumber(num);

        // Trigger effects
        triggerConfetti();

        // Pick a random phrase
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

        // Emit to backend
        if (socketRef.current) {
            socketRef.current.emit('master_draw', { number: num });
        }

        await announceNumber(num, randomPhrase);
    };

    const reAnnounce = () => {
        if (!isAuthorized) return; // Block reAnnounce if not authorized
        if (currentNumber) {
            announceNumber(currentNumber);
        }
    };

    const announceNumber = (num, prefix = "") => {
        // Function remains the same, but protected by the 'drawNumber' caller's auth check.
        setIsSpeaking(true);
        const bingoCall = getBingoCall(num);
        const text = prefix ? `${prefix} ${bingoCall}` : bingoCall;

        // Use browser native TTS for reliability
        const u = new SpeechSynthesisUtterance(text);

        // Optional: Select a better voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang === 'en-US' && !v.name.includes('Google')) || voices[0];
        if (preferredVoice) u.voice = preferredVoice;

        u.rate = 0.9; // Slightly slower for clarity
        u.pitch = 1;

        u.onend = () => setIsSpeaking(false);
        u.onerror = (e) => {
            console.error("SpeechSynthesis Error:", e);
            setIsSpeaking(false);
        };

        window.speechSynthesis.speak(u);
    };

    const getBingoCall = (num) => {
        const calls = {
            1: "Kelly's Eye",
            11: "Legs Eleven",
            22: "Two Little Ducks",
            66: "Clickety Click",
            90: "Top of the Shop",
        };
        // Reduced "Number" repetition
        const phrase = calls[num] ? `${num}, ${calls[num]}!` : `${num}!`;
        return phrase;
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    };

    const togglePause = () => {
        if (!isAuthorized) return; // Block pause if not authorized
        setIsPaused(!isPaused);
    };

    const resetGame = () => {
        if (!isAuthorized) return; // Block reset if not authorized
        setDrawnNumbers([]);
        setCurrentNumber(null);
        setWinners([]);
        setIsPaused(false);
        setCountdown(3);
        // Note: Resetting isAuthorized back to false requires a new call to /start_session
        // If you want to require re-auth on reset, you'd need a /stop_session endpoint on the backend.
    };

    if (!isAuthorized) {
        return (
            <div className="master-container auth-page">
                <div className="auth-box">
                    <h2>Bingo Master Authorization</h2>
                    <p>Please enter the secret ID to start the game session.</p>
                    <form onSubmit={handleAuthSubmit}>
                        <input
                            type="password"
                            value={secretIdInput}
                            onChange={(e) => setSecretIdInput(e.target.value)}
                            placeholder="Secret ID (e.g., 13122025)"
                            required
                        />
                        <button type="submit">Authorize and Start</button>
                        {authError && <p className="auth-error">{authError}</p>}
                    </form>
                </div>
            </div>
        );
    }


    return (
        <div className="master-container">
            <div className="header">
                <h1>Bingo Master Board</h1>
                <div className="controls">
                    {drawnNumbers.length < 90 ? (
                        <>
                            <button onClick={drawNumber} disabled={isSpeaking || (drawnNumbers.length > 0 && !isPaused && countdown > 0)} className="draw-btn">
                                {currentNumber ? 'Draw Next' : 'Start Game'}
                            </button>
                            <button onClick={togglePause} disabled={drawnNumbers.length === 0} className={`pause-btn ${isPaused ? 'paused' : ''}`}>
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button onClick={reAnnounce} disabled={!currentNumber || isSpeaking} className="redo-btn">
                                Redo
                            </button>
                        </>
                    ) : (
                        <button onClick={resetGame} className="draw-btn">
                            Start New Game
                        </button>
                    )}
                </div>
            </div>

            <div className="main-content">
                <div className="left-panel">
                    <div className="current-draw">
                        {drawnNumbers.length >= 90 ? (
                            <div className="game-over">
                                <h2>Game Over!</h2>
                                <p>Congratulations Winners!</p>
                            </div>
                        ) : (
                            <>
                                <div className="big-number">{currentNumber || '-'}</div>
                                <div className="comic-text">{currentNumber && getBingoCall(currentNumber)}</div>
                                {drawnNumbers.length > 0 && !isPaused && !isSpeaking && (
                                    <div className="countdown-small">
                                        Next draw in: <span>{countdown}</span>s
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="winners-list">
                        <h3>Winners</h3>
                        {winners.length === 0 ? (
                            <p className="no-winners">No winners yet...</p>
                        ) : (
                            <ul>
                                {winners.map((win, idx) => (
                                    <li key={idx} className="winner-item">
                                        <span className="winner-rank">#{winners.length - idx}</span>
                                        <span className="winner-name">{win.name}</span>
                                        <span className="winner-type">{win.type}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="board">
                    {Array.from({ length: 90 }, (_, i) => i + 1).map(n => (
                        <div
                            key={n}
                            className={`board-number ${drawnNumbers.includes(n) ? 'drawn' : ''} ${currentNumber === n ? 'current' : ''}`}
                        >
                            {n}
                        </div>
                    ))}
                </div>

                <div className="qr-section">
                    <h3>Join the Game</h3>
                    <p>Scan to get your card</p>
                    <QRCodeCanvas value={gameUrl} size={128} />
                    <p className="url-text">{gameUrl}</p>
                </div>
            </div>
        </div>
    );
};

export default Master;