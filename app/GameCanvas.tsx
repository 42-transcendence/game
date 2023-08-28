"use client";

import Matter from "matter-js";
import { useEffect, useRef } from "react";

export function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current === null) {
            throw new Error("no canvas");
        }

        const WIDTH = 600;
        const HEIGHT = 800;
        const BALL_RADIUS = 36;
        const PADDLE_RADIUS = 80;
        const WIN_SCORE = 10;

        let player1Score = 0;
        let player2Score = 0;

        let paddle1Velocity = { x: 0, y: 0 };

        const lineCategory = 0x0002;

        // create engine
        const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
        const world = engine.world;

        // create renderer
        const render = Matter.Render.create({
            element: document.body,
            engine: engine,
            canvas: canvasRef.current,
            options: {
                width: WIDTH,
                height: HEIGHT,
                showAngleIndicator: true,
                showCollisions: true,
            },
        });

        const canvas = render.canvas;
        const canvasContext = canvas.getContext("2d");

        if (canvasContext === null) {
            throw new Error("no canvas");
        }

        canvasContext.font = "30px arial";
        Matter.Render.run(render);

        // Player1 paddle
        let paddle1X = WIDTH / 2;
        let paddle1Y = HEIGHT - BALL_RADIUS - 50;
        const paddle1 = Matter.Bodies.circle(
            paddle1X,
            paddle1Y,
            PADDLE_RADIUS,
            {
                isStatic: true,
                restitution: 1,
                frictionStatic: 0,
                frictionAir: 0,
                friction: 0,
            },
        );
        function calculateMousePos(event: MouseEvent) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            return {
                x: mouseX,
                y: mouseY,
            };
        }
        canvas.addEventListener("mousemove", function (event: MouseEvent) {
            const prevTimestamp = Date.now();
            const prevPointX = paddle1.position.x;
            const prevPointY = paddle1.position.y;
            const mousePos = calculateMousePos(event);
            paddle1Y = mousePos.y - PADDLE_RADIUS / 2;
            paddle1X = mousePos.x - PADDLE_RADIUS / 2;
            Matter.Body.setPosition(paddle1, { x: paddle1X, y: paddle1Y });
            //패들 중앙선 침범 금지~!
            if (paddle1.position.y < HEIGHT / 2 + PADDLE_RADIUS) {
                Matter.Body.setPosition(paddle1, {
                    x: paddle1.position.x,
                    y: HEIGHT / 2 + PADDLE_RADIUS,
                });
            }
            const deltaT = Date.now() - prevTimestamp + 1;
            paddle1Velocity = {
                x: (paddle1.position.x - prevPointX) / deltaT,
                y: (paddle1.position.y - prevPointY) / deltaT,
            };
        });
        Matter.Composite.add(world, paddle1);

        // Player2 paddle
        const paddle2X = WIDTH / 2,
            paddle2Y = BALL_RADIUS + 50;
        const paddle2 = Matter.Bodies.circle(
            paddle2X,
            paddle2Y,
            PADDLE_RADIUS,
            {
                isStatic: true,
                restitution: 1,
                frictionStatic: 0,
                frictionAir: 0,
                friction: 0,
            },
        );
        Matter.Composite.add(world, paddle2);

        //add line
        Matter.Composite.add(
            world,
            Matter.Bodies.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, 2, {
                isStatic: true,
                collisionFilter: {
                    mask: lineCategory,
                },
            }),
        );

        // create runner
        const runner = Matter.Runner.create();
        Matter.Runner.run(runner, engine);

        // Event On!
        Matter.Events.on(runner, "tick", (_event: Event) => {
            const collided =
                Matter.Collision.collides(paddle1, circle, []) ??
                Matter.Collision.collides(paddle2, circle, []);
            const velocity = Matter.Body.getVelocity(circle);

            if (collided?.collided === true) {
                if (
                    collided.normal.x * velocity.x +
                        collided.normal.y * velocity.y >=
                    0
                ) {
                    const theta = Math.atan2(
                        collided.normal.y,
                        collided.normal.x,
                    );
                    const alpha = Math.atan2(velocity.y, velocity.x);
                    const newVx =
                        velocity.x * Math.cos(2 * theta - 2 * alpha) -
                        velocity.y * Math.sin(2 * theta - 2 * alpha);
                    const newVy =
                        velocity.x * Math.sin(2 * theta - 2 * alpha) +
                        velocity.y * Math.cos(2 * theta - 2 * alpha);
                    Matter.Body.setVelocity(circle, {
                        x: newVx * -1.1,
                        y: newVy * -1.1,
                    });
                }
                Matter.Body.setVelocity(circle, {
                    x: circle.velocity.x + paddle1Velocity.x / 4,
                    y: circle.velocity.y + paddle1Velocity.y / 4,
                });
                paddle1Velocity = { x: 0, y: 0 };
            }
            //반사!
            if (circle.position.x < BALL_RADIUS) {
                Matter.Body.setPosition(circle, {
                    x: BALL_RADIUS,
                    y: circle.position.y,
                });
                Matter.Body.setVelocity(circle, {
                    x: velocity.x * -1,
                    y: velocity.y * 1,
                });
            } else if (circle.position.x > WIDTH - BALL_RADIUS) {
                Matter.Body.setPosition(circle, {
                    x: WIDTH - BALL_RADIUS,
                    y: circle.position.y,
                });
                Matter.Body.setVelocity(circle, {
                    x: velocity.x * -1,
                    y: velocity.y * 1,
                });
            }
            //점수 겟또
            if (circle.position.y < BALL_RADIUS) {
                player1Score++;
                Matter.Body.setPosition(circle, {
                    x: WIDTH / 2,
                    y: HEIGHT / 2,
                });
                Matter.Body.setVelocity(circle, { x: -15, y: -15 });
                Matter.Body.setAngularVelocity(circle, 0);
            } else if (circle.position.y > HEIGHT - BALL_RADIUS) {
                player2Score++;
                Matter.Body.setPosition(circle, {
                    x: WIDTH / 2,
                    y: HEIGHT / 2,
                });
                Matter.Body.setVelocity(circle, { x: 15, y: 15 });
                Matter.Body.setAngularVelocity(circle, 0);
            }
            if (player1Score >= WIN_SCORE) {
                canvasContext.fillText(
                    "Player 1 Wins!",
                    WIDTH / 2 - 100,
                    HEIGHT / 2,
                );
                Matter.Render.stop(render);
                Matter.Runner.stop(runner);
            } else if (player2Score >= WIN_SCORE) {
                canvasContext.fillText(
                    "Player 2 Wins!",
                    WIDTH / 2 - 100,
                    HEIGHT / 2,
                );
                Matter.Render.stop(render);
                Matter.Runner.stop(runner);
            }
            //속도제한
            if (circle.velocity.x > 35) {
                Matter.Body.setVelocity(circle, {
                    x: 35,
                    y: circle.velocity.y,
                });
            }
            if (circle.velocity.y > 35) {
                Matter.Body.setVelocity(circle, {
                    x: circle.velocity.x,
                    y: 35,
                });
            }
            canvasContext.fillText(
                "Player 2 score: " + player2Score + `/${WIN_SCORE}`,
                WIDTH / 2 - 150,
                25,
            );
            canvasContext.fillText(
                "Player 1 score: " + player1Score + `/${WIN_SCORE}`,
                WIDTH / 2 - 150,
                1900,
            );
        });

        //ball
        const circle = Matter.Bodies.circle(500, 960, BALL_RADIUS, {
            frictionStatic: 0,
            frictionAir: 0,
            friction: 0,
            restitution: 1,
        });
        Matter.Body.setInertia(circle, 0.00001);
        Matter.Body.setVelocity(circle, { x: 15, y: 15 });
        Matter.Composite.add(world, circle);

        Matter.Render.lookAt(render, {
            min: { x: 0, y: 0 },
            max: { x: WIDTH, y: HEIGHT },
        });
    }, []);

    return <canvas ref={canvasRef}></canvas>;
}
