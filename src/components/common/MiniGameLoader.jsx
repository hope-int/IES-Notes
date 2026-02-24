import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

// --- TIC TAC TOE ---
const TicTacToe = () => {
    const [board, setBoard] = useState(Array(9).fill(null));
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [winner, setWinner] = useState(null);

    const checkWinner = (squares) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        if (!squares.includes(null)) return 'Draw';
        return null;
    };

    const handleClick = (index) => {
        if (board[index] || winner || !isPlayerTurn) return;

        const newBoard = [...board];
        newBoard[index] = 'X';
        setBoard(newBoard);

        const currentWinner = checkWinner(newBoard);
        if (currentWinner) {
            setWinner(currentWinner);
            return;
        }

        setIsPlayerTurn(false);

        // AI Turn
        setTimeout(() => {
            const emptyIndexes = newBoard.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
            if (emptyIndexes.length > 0) {
                const aiMove = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
                newBoard[aiMove] = 'O';
                setBoard([...newBoard]);
                setWinner(checkWinner(newBoard));
            }
            setIsPlayerTurn(true);
        }, 500);
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <h3 className="font-bold text-slate-700">Beat the AI while you wait!</h3>
            <div className="grid grid-cols-3 gap-2 bg-slate-200 p-2 rounded-xl">
                {board.map((cell, index) => (
                    <button
                        key={index}
                        onClick={() => handleClick(index)}
                        className="w-16 h-16 bg-white rounded-lg text-2xl font-black flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
                        disabled={!!winner || !!cell || !isPlayerTurn}
                    >
                        <span className={cell === 'X' ? 'text-indigo-600' : 'text-rose-500'}>{cell}</span>
                    </button>
                ))}
            </div>
            {winner && (
                <div className="flex flex-col items-center gap-2">
                    <p className="font-bold text-lg">{winner === 'Draw' ? "It's a draw!" : `${winner} wins!`}</p>
                    <button onClick={() => { setBoard(Array(9).fill(null)); setWinner(null); setIsPlayerTurn(true); }} className="text-sm px-3 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 font-medium">Play Again</button>
                </div>
            )}
        </div>
    );
};

// --- FLAPPY BIRD ---
const GRAVITY = 0.6;
const JUMP = -8;
const PIPE_SPEED = 3;
const PIPE_WIDTH = 50;
const PIPE_GAP = 130;

const FlappyBird = () => {
    const [birdPos, setBirdPos] = useState(200);
    const [velocity, setVelocity] = useState(0);
    const [pipes, setPipes] = useState([]);
    const [isGameOver, setIsGameOver] = useState(false);
    const [score, setScore] = useState(0);
    const [gameStarted, setGameStarted] = useState(false);
    const frameRef = useRef();

    const jump = () => {
        if (!gameStarted) {
            setGameStarted(true);
            setIsGameOver(false);
            setScore(0);
            setBirdPos(200);
            setPipes([{ x: 400, topHeight: Math.random() * 200 + 50 }]);
        }
        if (!isGameOver) {
            setVelocity(JUMP);
        }
    };

    useEffect(() => {
        if (gameStarted && !isGameOver) {
            const updateGame = () => {
                setBirdPos((v) => {
                    const newPos = v + velocity;
                    if (newPos > 400 || newPos < 0) {
                        setIsGameOver(true);
                        return v;
                    }
                    return newPos;
                });
                setVelocity((v) => v + GRAVITY);

                setPipes((currentPipes) => {
                    return currentPipes.map(pipe => {
                        const newX = pipe.x - PIPE_SPEED;
                        // Collision check
                        if (newX < 50 + 20 && newX + PIPE_WIDTH > 50) {
                            if (birdPos < pipe.topHeight || birdPos + 20 > pipe.topHeight + PIPE_GAP) {
                                setIsGameOver(true);
                            }
                        }
                        // Score check
                        if (newX === 50) setScore(s => s + 1);
                        return { ...pipe, x: newX };
                    }).filter(pipe => pipe.x > -PIPE_WIDTH).concat(
                        currentPipes.length > 0 && currentPipes[currentPipes.length - 1].x < 200
                            ? [{ x: 400, topHeight: Math.random() * 200 + 50 }]
                            : []
                    );
                });
                frameRef.current = requestAnimationFrame(updateGame);
            };
            frameRef.current = requestAnimationFrame(updateGame);
        }
        return () => cancelAnimationFrame(frameRef.current);
    }, [gameStarted, isGameOver, velocity, birdPos]);

    return (
        <div className="flex flex-col items-center gap-2 select-none">
            <h3 className="font-bold text-slate-700">Flappy Bird! Click to jump.</h3>
            <div
                className="w-[300px] h-[400px] bg-sky-200 rounded-xl relative overflow-hidden cursor-pointer shadow-inner border-2 border-slate-200"
                onMouseDown={jump}
                onTouchStart={jump}
            >
                {!gameStarted && !isGameOver && (
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-white bg-black/20">Click to Start</div>
                )}
                {/* Bird */}
                <div
                    className="absolute w-[24px] h-[24px] bg-yellow-400 rounded-full border-2 border-slate-800 flex items-center justify-center"
                    style={{ left: '50px', top: `${birdPos}px`, transition: 'top 0.1s linear' }}
                >
                    <div className="w-1.5 h-1.5 bg-black rounded-full absolute right-1 top-1" />
                </div>
                {/* Pipes */}
                {pipes.map((pipe, i) => (
                    <React.Fragment key={i}>
                        <div className="absolute bg-emerald-500 border-2 border-slate-800 rounded-b-lg" style={{ left: `${pipe.x}px`, top: 0, width: `${PIPE_WIDTH}px`, height: `${pipe.topHeight}px` }} />
                        <div className="absolute bg-emerald-500 border-2 border-slate-800 rounded-t-lg" style={{ left: `${pipe.x}px`, top: `${pipe.topHeight + PIPE_GAP}px`, width: `${PIPE_WIDTH}px`, height: `400px` }} />
                    </React.Fragment>
                ))}
            </div>
            <div className="flex justify-between w-[300px] px-2 font-bold text-slate-600">
                <span>Score: {score}</span>
                {isGameOver && <span className="text-rose-500 animate-pulse">Game Over!</span>}
            </div>
        </div>
    );
};

export const MiniGameLoader = ({ loadingText = "Generating Magic...", subText = "Hold tight" }) => {
    const [gameType, setGameType] = useState('tictactoe');

    useEffect(() => {
        // Randomly open a game
        const games = ['tictactoe', 'flappybird'];
        setGameType(games[Math.floor(Math.random() * games.length)]);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center w-full min-h-[400px] py-12 px-4 relative z-10">
            {/* Loading Header */}
            <div className="flex flex-col items-center mb-8">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <h3 className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight text-center">{loadingText}</h3>
                <p className="text-slate-500 font-medium text-center">{subText}</p>
            </div>

            {/* Mini Game Container */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 relative"
            >
                <div className="absolute -top-3 -right-3">
                    <button
                        onClick={() => setGameType(prev => prev === 'tictactoe' ? 'flappybird' : 'tictactoe')}
                        className="bg-white text-slate-400 hover:text-indigo-600 p-2 rounded-full shadow-md border border-slate-100 transition-colors"
                        title="Switch Game"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {gameType === 'tictactoe' && <TicTacToe />}
                {gameType === 'flappybird' && <FlappyBird />}
            </motion.div>
        </div>
    );
};

export default MiniGameLoader;
