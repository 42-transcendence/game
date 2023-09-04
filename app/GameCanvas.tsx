"use client";

import Matter from "matter-js";
import { useEffect, useRef } from "react";

export function GameCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {

        // replay
        type PhysicsAttribute = {
            position: { x: number, y: number },
            velocity: { x: number, y: number },
        }
        type Frame = {
            id: number,
            paddle1: PhysicsAttribute,
            paddle2: PhysicsAttribute,
            ball: PhysicsAttribute,
            player1Score: number,
            player2Score: number
        }

        class Game {
            private WIDTH = 1000;
            private HEIGHT = 1920;
            private BALL_RADIUS = 36;
            private PADDLE_RADIUS = 80;
            private WIN_SCORE = 5;
            //score
            private player1Score = 0;
            private player2Score = 0;
            //paddle1 velocity
            private paddle1Velocity = { x: 0, y: 0 };
            private paddle2Velocity = { x: 0, y: 0 };
            //ignore collision
            private lineCategory = 0x0002;
            // create engine
            private engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
            private world = this.engine.world;
            // create renderer
            private render: Matter.Render;
            private canvas: HTMLCanvasElement;
            private canvasContext: CanvasRenderingContext2D | null;
            // Player1 paddle
            private paddle1X = this.WIDTH / 2;
            private paddle1Y = this.HEIGHT - this.BALL_RADIUS - 50;
            private paddle1 = Matter.Bodies.circle(
                this.paddle1X,
                this.paddle1Y,
                this.PADDLE_RADIUS,
                {
                    isStatic: true,
                    restitution: 1,
                    frictionStatic: 0,
                    frictionAir: 0,
                    friction: 0,
                },
            );
            // Player2 paddle
            private paddle2X = this.WIDTH / 2;
            private paddle2Y = this.BALL_RADIUS + 50;
            private paddle2 = Matter.Bodies.circle(
                this.paddle2X,
                this.paddle2Y,
                this.PADDLE_RADIUS,
                {
                    isStatic: true,
                    restitution: 1,
                    frictionStatic: 0,
                    frictionAir: 0,
                    friction: 0,
                },
            );
            // create runner
            private runner = Matter.Runner.create();
            //ball
            private circle = Matter.Bodies.circle(this.WIDTH / 2, this.HEIGHT / 2, this.BALL_RADIUS, {
                frictionStatic: 0,
                frictionAir: 0,
                friction: 0,
                restitution: 1,
            });
            private framesPerSecond = 60;
            private frames: Frame[] = [];

            // gravity object
            private attractiveBody1 = Matter.Bodies.circle(
                700,
                1200,
                50,
                {
                    isStatic: true,
                    collisionFilter: {
                        mask: this.lineCategory
                    }
                });
            private attractiveBody2 = Matter.Bodies.circle(
                300,
                650,
                50,
                {
                    isStatic: true,
                    collisionFilter: {
                        mask: this.lineCategory
                    }
                });


            constructor() {
                // XXX
                if (canvasRef.current === null) {
                    throw new Error("no canvas");
                }
                this.render = Matter.Render.create({
                    element: document.body,
                    engine: this.engine,
                    canvas: canvasRef.current, // XXX
                    options: {
                        width: this.WIDTH,
                        height: this.HEIGHT,
                        showAngleIndicator: true,
                        showCollisions: true,
                    },
                });
                this.canvas = this.render.canvas;
                this.canvasContext = this.canvas.getContext("2d");
                // XXX
                if (this.canvasContext === null) {
                    throw new Error("no canvas");
                }

                this.canvasContext.font = "30px arial";
                Matter.Body.setInertia(this.circle, 0.00001);
                Matter.Body.setVelocity(this.circle, { x: 15, y: 15 });
            }

            private calculateMousePos(event: MouseEvent) {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = event.clientX - rect.left;
                const mouseY = event.clientY - rect.top;
                return {
                    x: mouseX,
                    y: mouseY,
                };
            }

            //ball reflection
            private reflection(normalVec: { x: number, y: number }, ball: Matter.Body) {
                const velocity = Matter.Body.getVelocity(ball);
                if (normalVec.x * velocity.x + normalVec.y * velocity.y >= 0) {
                    const theta = Math.atan2(normalVec.y, normalVec.x);
                    const alpha = Math.atan2(velocity.y, velocity.x);
                    const newVx = velocity.x * Math.cos(2 * theta - 2 * alpha) - velocity.y * Math.sin(2 * theta - 2 * alpha);
                    const newVy = velocity.x * Math.sin(2 * theta - 2 * alpha) + velocity.y * Math.cos(2 * theta - 2 * alpha);
                    Matter.Body.setVelocity(ball, { x: newVx * -1.1, y: newVy * -1.1 });
                }
            }

            private wallReflection(velocity: { x: number, y: number }) {
                //반사!
                if (this.circle.position.x < this.BALL_RADIUS) {
                    Matter.Body.setPosition(this.circle, {
                        x: this.BALL_RADIUS,
                        y: this.circle.position.y,
                    });
                    Matter.Body.setVelocity(this.circle, {
                        x: velocity.x * -1,
                        y: velocity.y * 1,
                    });
                } else if (this.circle.position.x > this.WIDTH - this.BALL_RADIUS) {
                    Matter.Body.setPosition(this.circle, {
                        x: this.WIDTH - this.BALL_RADIUS,
                        y: this.circle.position.y,
                    });
                    Matter.Body.setVelocity(this.circle, {
                        x: velocity.x * -1,
                        y: velocity.y * 1,
                    });
                }
            }

            private limitVelocity() {
                //속도제한
                if (this.circle.velocity.x > 35) {
                    Matter.Body.setVelocity(this.circle, {
                        x: 35,
                        y: this.circle.velocity.y,
                    });
                }
                if (this.circle.velocity.y > 35) {
                    Matter.Body.setVelocity(this.circle, {
                        x: this.circle.velocity.x,
                        y: 35,
                    });
                }
            }

            private getScore() {
                //점수 겟또
                if (this.circle.position.y < this.BALL_RADIUS) {
                    this.player1Score++;
                    Matter.Body.setPosition(this.circle, {
                        x: this.WIDTH / 2,
                        y: this.HEIGHT / 2,
                    });
                    Matter.Body.setVelocity(this.circle, { x: -15, y: -15 });
                    Matter.Body.setAngularVelocity(this.circle, 0);
                } else if (this.circle.position.y > this.HEIGHT - this.BALL_RADIUS) {
                    this.player2Score++;
                    Matter.Body.setPosition(this.circle, {
                        x: this.WIDTH / 2,
                        y: this.HEIGHT / 2,
                    });
                    Matter.Body.setVelocity(this.circle, { x: 15, y: 15 });
                    Matter.Body.setAngularVelocity(this.circle, 0);
                }
            }

            private drawScore() {
                if (this.canvasContext === null)
                    return;
                this.canvasContext.fillText(
                    "Player 2 score: " + this.player2Score + `/${this.WIN_SCORE}`,
                    this.WIDTH / 2 - 150,
                    25,
                );
                this.canvasContext.fillText(
                    "Player 1 score: " + this.player1Score + `/${this.WIN_SCORE}`,
                    this.WIDTH / 2 - 150,
                    1900,
                );
            }

            private judgeWinner() {
                if (this.canvasContext === null)
                    return;
                if (this.player1Score >= this.WIN_SCORE) {
                    this.canvasContext.fillText(
                        "Player 1 Wins!",
                        this.WIDTH / 2 - 100,
                        this.HEIGHT / 2,
                    );
                    Matter.Engine.clear(this.engine);
                    Matter.Render.stop(this.render);
                    Matter.Runner.stop(this.runner);
                    // playFrame();
                } else if (this.player2Score >= this.WIN_SCORE) {
                    this.canvasContext.fillText(
                        "Player 2 Wins!",
                        this.WIDTH / 2 - 100,
                        this.HEIGHT / 2,
                    );
                    Matter.Engine.clear(this.engine);
                    Matter.Render.stop(this.render);
                    Matter.Runner.stop(this.runner);
                    // playFrame();
                }
            }

            private sendFrame() {
                if (this.player1Score === this.WIN_SCORE || this.player2Score === this.WIN_SCORE) {
                    return;
                }
                const frame: Frame = {
                    id: this.frames.length,
                    paddle1: {
                        position: { x: this.paddle1.position.x, y: this.paddle1.position.y },
                        velocity: { x: this.paddle1Velocity.x, y: this.paddle1Velocity.y },
                    },
                    paddle2: {
                        position: { x: this.paddle2.position.x, y: this.paddle2.position.y },
                        velocity: { x: 0, y: 0 },
                    },
                    ball: {
                        position: { x: this.circle.position.x, y: this.circle.position.y },
                        velocity: { x: this.circle.velocity.x, y: this.circle.velocity.y },
                    }
                    ,
                    player1Score: this.player1Score,
                    player2Score: this.player2Score
                }
                this.frames.push(frame);
            }

            //gravity
            private attractive(attractiveBody: Matter.Body, body: Matter.Body, gravityConstant: number) {
                const normal = { x: attractiveBody.position.x - body.position.x, y: attractiveBody.position.y - body.position.y }
                const distance = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
                const force = { x: gravityConstant * normal.x / (distance * + 1), y: gravityConstant * normal.y / (distance + 1) };
                Matter.Body.setVelocity(body, { x: body.velocity.x + force.x / 3, y: body.velocity.y + force.y / 3 })
            }

            private setGravity() {
                Matter.Composite.add(this.world, [this.attractiveBody1, this.attractiveBody2]);
            }

            start() {
                Matter.Render.run(this.render);
                this.canvas.addEventListener("mousemove", (event: MouseEvent) => {
                    const prevTimestamp = Date.now();
                    const prevPointX = this.paddle1.position.x;
                    const prevPointY = this.paddle1.position.y;
                    const mousePos = this.calculateMousePos(event);
                    this.paddle1Y = mousePos.y - this.PADDLE_RADIUS / 2;
                    this.paddle1X = mousePos.x - this.PADDLE_RADIUS / 2;
                    Matter.Body.setPosition(this.paddle1, { x: this.paddle1X, y: this.paddle1Y });
                    //패들 중앙선 침범 금지~!
                    if (this.paddle1.position.y < this.HEIGHT / 2 + this.PADDLE_RADIUS) {
                        Matter.Body.setPosition(this.paddle1, {
                            x: this.paddle1.position.x,
                            y: this.HEIGHT / 2 + this.PADDLE_RADIUS,
                        });
                    }
                    const deltaT = Date.now() - prevTimestamp + 1;
                    this.paddle1Velocity = {
                        x: (this.paddle1.position.x - prevPointX) / deltaT,
                        y: (this.paddle1.position.y - prevPointY) / deltaT,
                    };
                });
                //중력객체 추가
                this.setGravity();
                //add paddles
                Matter.Composite.add(this.world, this.paddle1);
                Matter.Composite.add(this.world, this.paddle2);
                //add line
                Matter.Composite.add(
                    this.world,
                    Matter.Bodies.rectangle(this.WIDTH / 2, this.HEIGHT / 2, this.WIDTH, 2, {
                        isStatic: true,
                        collisionFilter: {
                            mask: this.lineCategory,
                        },
                    }),
                );
                Matter.Runner.run(this.runner, this.engine);
                //add ball
                Matter.Composite.add(this.world, this.circle);
                Matter.Render.lookAt(this.render, {
                    min: { x: 0, y: 0 },
                    max: { x: this.WIDTH, y: this.HEIGHT },
                });

                // Event On!
                Matter.Events.on(this.runner, "tick", (_event: Event) => {
                    // XXX
                    if (this.canvasContext === null) {
                        throw new Error("no canvas");
                    }
                    const collided = Matter.Collision.collides(this.paddle1, this.circle, 0) ?? Matter.Collision.collides(this.paddle2, this.circle, 0);
                    const velocity = Matter.Body.getVelocity(this.circle);

                    if (collided?.collided === true) {
                        this.reflection(collided.normal, this.circle)
                        Matter.Body.setVelocity(this.circle, {
                            x: this.circle.velocity.x + this.paddle1Velocity.x / 8,
                            y: this.circle.velocity.y + this.paddle1Velocity.y / 8,
                        });
                        this.paddle1Velocity = { x: 0, y: 0 };
                    }
                    //paddle2의 속도추가
                    Matter.Body.setPosition(this.paddle2, { x: this.paddle2.position.x + this.paddle2Velocity.x, y: this.paddle2.position.y + this.paddle2Velocity.y })
                    //반사!
                    this.wallReflection(velocity)
                    //점수 겟또
                    this.getScore();
                    //속도제한
                    this.limitVelocity();
                    //중력!
                    this.attractive(this.attractiveBody1, this.circle, 1);
                    this.attractive(this.attractiveBody2, this.circle, 0.5);
                    //프레임 보내기
                    this.sendFrame();
                    //승점계산
                    this.judgeWinner();
                    this.drawScore();
                });
            }
        }

        const game: Game = new Game();
        game.start();

        /////////frame////////////

        // // frame_save
        // const framesPerSecond = 60;
        // setInterval(setFrame, 1000 / framesPerSecond, paddle1, paddle1Velocity, paddle2, circle);

        // // replay
        // function setFrame(paddle1: Matter.Body, paddle1V: { x: number, y: number }, paddle2: Matter.Body, ball: Matter.Body) {
        //     if (player1Score === WIN_SCORE || player2Score === WIN_SCORE)
        //         return;
        //     const frame: Frame = {
        //         paddle1: {
        //             position: { x: paddle1.position.x, y: paddle1.position.y },
        //             velocity: { x: paddle1V.x, y: paddle1V.y },
        //         },
        //         paddle2: {
        //             position: { x: paddle2.position.x, y: paddle2.position.y },
        //             velocity: { x: 0, y: 0 },
        //         },
        //         ball: {
        //             position: { x: ball.position.x, y: ball.position.y },
        //             velocity: { x: ball.velocity.x, y: ball.velocity.y },
        //         }
        //         ,
        //         player1Score: player1Score,
        //         player2Score: player2Score
        //     }
        //     frames.push(frame);

        //     if (counter++ % 120 === 0) {
        //         console.log("in set!", frame)
        //     }
        // }
        // let counter = 0;
        // function playFrame() {
        //     // XXX
        //     if (canvasRef.current === null) {
        //         throw new Error("no canvas");
        //     }

        //     // create replay engine
        //     const replayEngine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
        //     const replayWorld = replayEngine.world;

        //     // create renderer
        //     const replayRender = Matter.Render.create({
        //         element: document.body,
        //         engine: replayEngine,
        //         canvas: canvasRef.current,
        //         options: {
        //             width: WIDTH,
        //             height: HEIGHT,
        //             showAngleIndicator: true,
        //             showCollisions: true,
        //         },
        //     });

        //     const replayCanvas = replayRender.canvas;
        //     const replayCanvasContext = replayCanvas.getContext("2d");

        //     // XXX
        //     if (replayCanvasContext === null) {
        //         throw new Error("no canvas");
        //     }

        //     replayCanvasContext.font = "30px arial";
        //     Matter.Render.run(replayRender);
        //     // Player1 paddle
        //     let paddle1X = WIDTH / 2;
        //     let paddle1Y = HEIGHT - BALL_RADIUS - 50;
        //     const paddle1 = Matter.Bodies.circle(
        //         paddle1X,
        //         paddle1Y,
        //         PADDLE_RADIUS,
        //         {
        //             isStatic: true,
        //             restitution: 1,
        //             frictionStatic: 0,
        //             frictionAir: 0,
        //             friction: 0,
        //         },
        //     );
        //     Matter.Composite.add(replayWorld, paddle1);
        //     // Player2 paddle
        //     const paddle2X = WIDTH / 2,
        //         paddle2Y = BALL_RADIUS + 50;
        //     const paddle2 = Matter.Bodies.circle(
        //         paddle2X,
        //         paddle2Y,
        //         PADDLE_RADIUS,
        //         {
        //             isStatic: true,
        //             restitution: 1,
        //             frictionStatic: 0,
        //             frictionAir: 0,
        //             friction: 0,
        //         },
        //     );
        //     Matter.Composite.add(replayWorld, paddle2);
        //     //add line
        //     Matter.Composite.add(
        //         replayWorld,
        //         Matter.Bodies.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, 2, {
        //             isStatic: true,
        //             collisionFilter: {
        //                 mask: lineCategory,
        //             },
        //         }),
        //     );
        //     // create runner
        //     const replayRunner = Matter.Runner.create();
        //     Matter.Runner.run(replayRunner, replayEngine);

        //     //ball
        //     const circle = Matter.Bodies.circle(500, 960, BALL_RADIUS, {
        //         frictionStatic: 0,
        //         frictionAir: 0,
        //         friction: 0,
        //         restitution: 1,
        //     });
        //     Matter.Body.setInertia(circle, 0.00001);
        //     Matter.Body.setVelocity(circle, { x: 15, y: 15 });
        //     Matter.Composite.add(replayWorld, circle);

        //     Matter.Render.lookAt(replayRender, {
        //         min: { x: 0, y: 0 },
        //         max: { x: WIDTH, y: HEIGHT },
        //     });

        //     setInterval(() => {
        //         if (frames.length === 0) {
        //             Matter.Engine.clear(replayEngine);
        //             Matter.Render.stop(replayRender);
        //             Matter.Runner.stop(replayRunner);
        //             return;
        //         }
        //         const nowFrame: Frame = frames[0];
        //         const nowPaddle1Position = nowFrame.paddle1.position;
        //         const nowPaddle1Velocity = nowFrame.paddle1.velocity;
        //         const nowPaddle2Position = nowFrame.paddle2.position;
        //         const nowPaddle2Velocity = nowFrame.paddle2.velocity;
        //         const nowBallPosition = nowFrame.ball.position;
        //         const nowBallVelocity = nowFrame.ball.velocity;
        //         Matter.Body.setPosition(paddle1, nowPaddle1Position);
        //         Matter.Body.setVelocity(paddle1, nowPaddle1Velocity);
        //         Matter.Body.setPosition(paddle2, nowPaddle2Position);
        //         Matter.Body.setVelocity(paddle2, nowPaddle2Velocity);
        //         Matter.Body.setPosition(circle, nowBallPosition);
        //         Matter.Body.setVelocity(circle, nowBallVelocity);
        //         replayCanvasContext.fillText(
        //             "Player 2 score: " + nowFrame.player2Score + `/${WIN_SCORE}`,
        //             WIDTH / 2 - 150,
        //             25,
        //         );
        //         replayCanvasContext.fillText(
        //             "Player 1 score: " + nowFrame.player1Score + `/${WIN_SCORE}`,
        //             WIDTH / 2 - 150,
        //             1900,
        //         );
        //         frames.splice(0, 1);
        //     }, 1000 / framesPerSecond);
        // }

    }, []);

    return <canvas ref={canvasRef}></canvas>;
}
