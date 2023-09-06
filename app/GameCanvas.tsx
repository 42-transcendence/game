"use client";

import { useEffect, useRef } from "react";
import { Game } from './game/game'

export function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {

        const game: Game = new Game(new WebSocket("ws://localhost:3001"), 1, canvasRef);
        game.start();

    }, []);

    return <canvas ref={canvasRef}></canvas>;
}
