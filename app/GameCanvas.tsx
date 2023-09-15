"use client";

import { useEffect, useRef } from "react";
import { Game, GameClientOpcode, GameServerOpcode, readGravityObjs } from './game/game'
import { ByteBuffer } from "./library/byte-buffer";

export function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const webSocket = new WebSocket("ws://10.19.209.107:3002");
        webSocket.binaryType = "arraybuffer";
        webSocket.onopen = () => {
            console.log("웹소켓서버와 연결 성공");
        };

        // 2-2) 메세지 수신 이벤트 처리
        webSocket.onmessage = function (event) {
            const buf = ByteBuffer.from(event.data);
            const opcode = buf.readOpcode();
            if (opcode === GameClientOpcode.START) {
                const field = buf.readString();
                const gravitiesObj = readGravityObjs(buf);
                console.log(gravitiesObj);
                const setNo = buf.read1();
                const game: Game = new Game(webSocket, setNo, 1, field, gravitiesObj, canvasRef);
                game.start();
            }
        }

        // 2-3) 연결 종료 이벤트 처리
        webSocket.onclose = function () {
            console.log("서버 웹소켓 연결 종료");
        }

        // 2-4) 에러 발생 이벤트 처리
        webSocket.onerror = function (event) {
            console.log(event)
        }


    }, []);

    return <canvas ref={canvasRef}></canvas>;
}
