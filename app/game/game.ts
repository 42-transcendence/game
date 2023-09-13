import { ByteBuffer } from "../library/byte-buffer";
import Matter, { Bodies, Vector } from "matter-js";
import { RefObject } from "react";

function writePhysicsAttribute(payload: ByteBuffer, data: PhysicsAttribute) {
	payload.write4Float(data.position.x);
	payload.write4Float(data.position.y);
	payload.write4Float(data.velocity.x);
	payload.write4Float(data.velocity.y);
}

function writeFrame(payload: ByteBuffer, frame: Frame) {
	payload.write4Unsigned(frame.id);
	writePhysicsAttribute(payload, frame.paddle1);
	payload.writeBoolean(frame.paddle1Hit);
	writePhysicsAttribute(payload, frame.paddle2);
	payload.writeBoolean(frame.paddle2Hit);
	writePhysicsAttribute(payload, frame.ball);
	payload.write1(frame.player1Score);
	payload.write1(frame.player2Score);
}

function writeFrames(payload: ByteBuffer, frames: Frame[]) {
	payload.write2Unsigned(frames.length);
	for (let i = 0; i < frames.length; i++) {
		writeFrame(payload, frames[i]);
	}
}

function readPhysicsAttribute(payload: ByteBuffer): PhysicsAttribute {
	const posX = payload.read4Float();
	const posY = payload.read4Float();
	const velocX = payload.read4Float();
	const velocY = payload.read4Float();
	return { position: { x: posX, y: posY }, velocity: { x: velocX, y: velocY } };
}

function readFrame(payload: ByteBuffer): Frame {
	const id = payload.read4Unsigned();
	const paddle1 = readPhysicsAttribute(payload);
	const paddle1Hit = payload.readBoolean();
	const paddle2 = readPhysicsAttribute(payload);
	const paddle2Hit = payload.readBoolean();
	const ball = readPhysicsAttribute(payload);
	const player1Score = payload.read1();
	const player2Score = payload.read1();
	return { id, paddle1, paddle1Hit, paddle2, paddle2Hit, ball, player1Score, player2Score };
}

function readFrames(payload: ByteBuffer): Frame[] {
	const size = payload.read2Unsigned();
	const frames: Frame[] = []
	for (let i = 0; i < size; i++) {
		frames.push(readFrame(payload));
	}
	return frames;
}

function readFrameWithoutBall(payload: ByteBuffer): Frame {
	const id = payload.read4Unsigned();
	const paddle1 = readPhysicsAttribute(payload);
	const paddle1Hit = payload.readBoolean();
	const paddle2 = readPhysicsAttribute(payload);
	const paddle2Hit = payload.readBoolean();
	const ball: PhysicsAttribute = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } }
	const player1Score = payload.read1();
	const player2Score = payload.read1();
	return { id, paddle1, paddle1Hit, paddle2, paddle2Hit, ball, player1Score, player2Score };
}

function readFramesWithoutBall(payload: ByteBuffer): Frame[] {
	const size = payload.read2Unsigned();
	const frames: Frame[] = []
	for (let i = 0; i < size; i++) {
		frames.push(readFrameWithoutBall(payload));
	}
	return frames;
}

export const enum GameServerOpcode {
	HANDSHAKE,
	CREATE,
	START,
	FRAME
}

export const enum GameClientOpcode {
	INITIALIZE,
	ACCEPT,
	REJECT,
	START,
	RESYNC_ALL,
	RESYNC_PART,
	SYNC,
	WIN,
	LOSE,
	DRAW
}

// replay
type PhysicsAttribute = {
	position: { x: number, y: number },
	velocity: { x: number, y: number },
}
type Frame = {
	id: number,
	paddle1: PhysicsAttribute,
	paddle1Hit: boolean,
	paddle2: PhysicsAttribute,
	paddle2Hit: boolean,
	ball: PhysicsAttribute,
	player1Score: number,
	player2Score: number
}
type GravityObj = {
	pos: { x: number, y: number },
	radius: number,
	force: number
}
export class Game {
	private WIDTH = 1000;
	private HEIGHT = 1920;
	private BALL_RADIUS = 36;
	private PADDLE_RADIUS = 80;
	private WIN_SCORE = 5;
	//score
	private player1Score = 0;
	private player2Score = 0;
	//paddle1 velocity
	private myPaddleVelocity = { x: 0, y: 0 };
	private counterPaddleVelocity = { x: 0, y: 0 };
	//ignore collision
	private lineCategory = 0x0002;
	// create engine
	private engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
	private world = this.engine.world;
	// create renderer
	private render: Matter.Render;
	private canvas: HTMLCanvasElement;
	private canvasContext: CanvasRenderingContext2D | null;
	// my paddle
	private myPaddleX = this.WIDTH / 2;
	private myPaddleY = this.HEIGHT - this.BALL_RADIUS - 50;
	private myPaddle = Matter.Bodies.circle(
		this.myPaddleX,
		this.myPaddleY,
		this.PADDLE_RADIUS,
		{
			isStatic: true,
			restitution: 1,
			frictionStatic: 0,
			frictionAir: 0,
			friction: 0,
		},
	);
	// counter paddle
	private counterPaddleX = this.WIDTH / 2;
	private counterPaddleY = this.BALL_RADIUS + 50;
	private counterPaddle = Matter.Bodies.circle(
		this.counterPaddleX,
		this.counterPaddleY,
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
	private circleVelocity = { x: 15, y: 15 };
	private frameQueue: { resyncType: GameClientOpcode, frame: Frame }[] = [];

	constructor(private websocket: WebSocket, private readonly player: number, private readonly field: string, private readonly gravity: GravityObj[], canvasRef: RefObject<HTMLCanvasElement>) {
		if (this.player !== 1 && this.player !== 2) {
			// 플레이어에 이상한 넘버가 들어갔을때 에러처리;
		}
		if (field !== "normal" && field !== "ellipse") {
			// 필드에 이상한 문자열이 들어갔을때 에러처리;
		}
		if (this.player === 2) { // 원점대칭할 점
			this.originSymmetry(this.circleVelocity);
			for (let i = 0; i < this.gravity.length; i++) {
				this.midpointSymmetry(this.gravity[i].pos);
			}
		}
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
		Matter.Body.setVelocity(this.circle, this.circleVelocity);

		websocket.binaryType = 'arraybuffer';
		websocket.onmessage = (event: MessageEvent<ArrayBuffer>) => {
			const buf = ByteBuffer.from(event.data);
			const opcode = buf.readOpcode();
			if (opcode === GameClientOpcode.SYNC) {
				console.log("in")
				const frame: Frame = readFrame(buf);
				// if (this.player === 2) {
				// 	this.reverseFrame(frame);
				// }
				// //프레임 붙여넣기
				// this.pasteFrame(frame);
			}
			else if (opcode === GameClientOpcode.RESYNC_ALL) {
				const frames: Frame[] = readFrames(buf);
				const size = frames.length;
				for (let i = 0; i < size; i++) {
					if (this.player === 2) {
						this.reverseFrame(frames[i]);
					}
					this.pasteFrame(frames[i]);
					this.frameQueue.push({ resyncType: GameClientOpcode.RESYNC_ALL, frame: frames[i] })
				}
			}
			else if (opcode === GameClientOpcode.RESYNC_PART) {
				const frames: Frame[] = readFrames(buf);

				const size = frames.length;
				for (let i = 0; i < size; i++) {
					if (this.player === 2) {
						this.reverseFrame(frames[i]);
					}
					this.pasteFrame(frames[i]);
					this.frameQueue.push({ resyncType: GameClientOpcode.RESYNC_PART, frame: frames[i] })
				}
			}
		}
	}

	private pasteFrame(frame: Frame) {
		this.frames[frame.id] = frame
	}

	private midpointSymmetry(point: { x: number, y: number }) {
		point.x = this.WIDTH - point.x;
		point.y = this.HEIGHT - point.y;
	}

	private originSymmetry(point: { x: number, y: number }) {
		point.x *= -1;
		point.y *= -1;
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
			Matter.Body.setVelocity(ball, { x: newVx * -1.05, y: newVy * -1.05 });
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

	private makePointInEllipse(theta: number): { x: number, y: number } {
		const distance = ((this.WIDTH / 2) * (this.HEIGHT / 2)) / (Math.sqrt((((this.HEIGHT / 2) * Math.cos(theta)) ** 2) + (((this.WIDTH / 2) * Math.sin(theta)) ** 2)))
		return { x: distance * Math.cos(theta), y: distance * Math.sin(theta) };
	}

	private determinantNormal(circlePos: { x: number, y: number }, pointInEllipse: { x: number, y: number }): number {
		return (((this.WIDTH / 2) ** 2) * pointInEllipse.y * (pointInEllipse.x - circlePos.x)) - (((this.HEIGHT / 2) ** 2) * pointInEllipse.x * (pointInEllipse.y - circlePos.y));
	}

	private review(circlePos: { x: number, y: number }, pointInEllipse: { x: number, y: number }): number {
		return ((((this.WIDTH / 2) ** 2) * pointInEllipse.y * (pointInEllipse.x - circlePos.x)) / (((this.HEIGHT / 2) ** 2) * pointInEllipse.x * (pointInEllipse.y - circlePos.y)));
	}

	private oneQuadrantLogic(circlePos: { x: number, y: number }): number {
		let upper = Math.PI / 2;
		let lower = 0;
		while (true) {
			const theta = (upper + lower) / 2;
			const pointInEllipse = this.makePointInEllipse(theta);
			const num = this.review(circlePos, pointInEllipse)
			if ((upper - lower) * (180 / Math.PI) < 0.0005) {
				if (num > 1.1 || num < 0.9) {
					upper = Math.PI * (3 / 4);
					lower = -1 * Math.PI / 4;
				}
				else {
					return theta
				}
			}
			if (this.determinantNormal(circlePos, pointInEllipse) < 0) {
				upper = theta;
			}
			else if (this.determinantNormal(circlePos, pointInEllipse) > 0) {
				lower = theta;
			}
			else if (0.95 < num && num < 1.05) {
				return theta
			}
		}
	}


	private ellipseReflection() {
		const circlePos = { x: this.circle.position.x - this.WIDTH / 2, y: this.circle.position.y - this.HEIGHT / 2 };
		const normal = { x: 0, y: 0 };
		// x축 대칭
		circlePos.y *= -1;
		if (0 < circlePos.x && 0 < circlePos.y) { // 1사분면
			const theta = this.oneQuadrantLogic(circlePos);
			const pointInEllipse = this.makePointInEllipse(theta);
			normal.x = pointInEllipse.x - circlePos.x;
			normal.y = pointInEllipse.y - circlePos.y;
		}
		else if (0 > circlePos.x && 0 < circlePos.y) { // 2사분면
			circlePos.x *= -1;
			const theta = this.oneQuadrantLogic(circlePos);
			const pointInEllipse = this.makePointInEllipse(theta);
			normal.x = pointInEllipse.x - circlePos.x;
			normal.y = pointInEllipse.y - circlePos.y;
			normal.x *= -1;
		}
		else if (0 > circlePos.x && 0 > circlePos.y) { // 3사분면
			circlePos.x *= -1;
			circlePos.y *= -1;
			const theta = this.oneQuadrantLogic(circlePos);
			const pointInEllipse = this.makePointInEllipse(theta);
			normal.x = pointInEllipse.x - circlePos.x;
			normal.y = pointInEllipse.y - circlePos.y;
			normal.x *= -1;
			normal.y *= -1;
		}
		else if (0 < circlePos.x && 0 > circlePos.y) { // 4사분면
			circlePos.y *= -1;
			const theta = this.oneQuadrantLogic(circlePos);
			const pointInEllipse = this.makePointInEllipse(theta);
			normal.x = pointInEllipse.x - circlePos.x;
			normal.y = pointInEllipse.y - circlePos.y;
			normal.y *= -1;
		}
		if (this.circle.position.y === 0 || this.circle.position.y === this.HEIGHT) {
			Matter.Body.setVelocity(this.circle, { x: this.circle.velocity.x, y: this.circle.velocity.y * -1 })
		}
		if (this.circle.position.x === 0 || this.circle.position.x === this.WIDTH) {
			Matter.Body.setVelocity(this.circle, { x: this.circle.velocity.x * -1, y: this.circle.velocity.y })
		}
		// 다시 x축 대칭!
		normal.y *= -1;

		const inOutCheck = this.ellipseInOut(this.circle.position);
		if (Math.sqrt(normal.x ** 2 + normal.y ** 2) <= this.BALL_RADIUS && inOutCheck < 1) {
			const velocity = Matter.Body.getVelocity(this.circle);
			if (normal.x * velocity.x + normal.y * velocity.y >= 0) {
				const theta = Math.atan2(normal.y, normal.x);
				const alpha = Math.atan2(velocity.y, velocity.x);
				const newVx = velocity.x * Math.cos(2 * theta - 2 * alpha) - velocity.y * Math.sin(2 * theta - 2 * alpha);
				const newVy = velocity.x * Math.sin(2 * theta - 2 * alpha) + velocity.y * Math.cos(2 * theta - 2 * alpha);
				Matter.Body.setVelocity(this.circle, { x: newVx * -1, y: newVy * -1 });
			}
		}
		else if (inOutCheck >= 1) {
			Matter.Body.setPosition(this.circle, { x: this.circle.position.x + 5 * normal.x, y: this.circle.position.y + 5 * normal.y });
		}
	}

	private setEllipse() {
		const ellipseMajorAxis = this.HEIGHT;
		const ellipseMinorAxis = this.WIDTH;
		const ellipseVerticesArray: Vector[] = [];
		const ellipseVertices = 1000;
		for (let i = 0; i < 350; i++) {
			const a = Matter.Bodies.circle(
				this.WIDTH / 2 + Math.cos(i) * ((ellipseMinorAxis / 2) + 20),
				this.HEIGHT / 2 + Math.sin(i) * ((ellipseMajorAxis / 2) + 20),
				20,
				{
					isStatic: true,
				}
			);
			Matter.Composite.add(this.world, a);
		}
		for (let i = 0; i < ellipseVertices; i++) {
			const x = (ellipseMinorAxis / 2) * Math.cos(i);
			const y = (ellipseMajorAxis / 2) * Math.sin(i);
			ellipseVerticesArray.push({ x: x, y: y });
		}

		const ellipse = Matter.Bodies.fromVertices(this.WIDTH / 2, this.HEIGHT / 2, [ellipseVerticesArray], {
			isStatic: true,
			collisionFilter: {
				mask: this.lineCategory
			}
		});
		Matter.Composite.add(this.world, ellipse);
	}

	private limitVelocity() {
		//속도제한
		const limit = 35
		if (this.circle.velocity.x > limit) {
			Matter.Body.setVelocity(this.circle, {
				x: limit,
				y: this.circle.velocity.y,
			});
		}
		if (this.circle.velocity.y > limit) {
			Matter.Body.setVelocity(this.circle, {
				x: this.circle.velocity.x,
				y: limit,
			});
		}
	}

	private drawScore() {
		if (this.canvasContext === null)
			return;
		const player1DrawPos = this.player === 1 ? 1900 : 25
		const player2DrawPos = player1DrawPos === 1900 ? 25 : 1900
		this.canvasContext.fillText(
			"Player 2 score: " + this.player2Score + `/${this.WIN_SCORE}`,
			this.WIDTH / 2 - 150,
			player2DrawPos,
		);
		this.canvasContext.fillText(
			"Player 1 score: " + this.player1Score + `/${this.WIN_SCORE}`,
			this.WIDTH / 2 - 150,
			player1DrawPos,
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
		} else if (this.player2Score >= this.WIN_SCORE) {
			this.canvasContext.fillText(
				"Player 2 Wins!",
				this.WIDTH / 2 - 100,
				this.HEIGHT / 2,
			);
			Matter.Engine.clear(this.engine);
			Matter.Render.stop(this.render);
			Matter.Runner.stop(this.runner);
		}
	}

	private reverseFrame(frame: Frame) {
		this.midpointSymmetry(frame.paddle1.position);
		this.originSymmetry(frame.paddle1.velocity);
		this.midpointSymmetry(frame.paddle2.position);
		this.originSymmetry(frame.paddle2.velocity);
		this.midpointSymmetry(frame.ball.position);
		this.originSymmetry(frame.ball.velocity);
	}

	private ellipseInOut(point: { x: number, y: number }) {
		return ((((point.x - this.WIDTH / 2) ** 2) / ((this.WIDTH / 2) ** 2)) + (((point.y - this.HEIGHT / 2) ** 2) / ((this.HEIGHT / 2) ** 2)));
	}


	private sendFrame(paddle1Hit: boolean, paddle2Hit: boolean) {
		if (this.player1Score === this.WIN_SCORE || this.player2Score === this.WIN_SCORE) {
			return;
		}
		const myPaddle: PhysicsAttribute = {
			position: { x: this.myPaddle.position.x, y: this.myPaddle.position.y },
			velocity: { x: this.myPaddleVelocity.x, y: this.myPaddleVelocity.y },
		};
		const counterPaddle: PhysicsAttribute = {
			position: { x: this.counterPaddle.position.x, y: this.counterPaddle.position.y },
			velocity: { x: 0, y: 0 },
		}
		const frame: Frame = {
			id: this.frames.length,
			paddle1: this.player === 1 ? myPaddle : counterPaddle,
			paddle1Hit,
			paddle2: this.player === 1 ? counterPaddle : myPaddle,
			paddle2Hit,
			ball: {
				position: { x: this.circle.position.x + this.circle.velocity.x, y: this.circle.position.y + this.circle.velocity.y },
				velocity: { x: this.circle.velocity.x, y: this.circle.velocity.y },
			},
			player1Score: this.player1Score,
			player2Score: this.player2Score
		}
		if (this.player === 2) {
			this.reverseFrame(frame);
		}
		this.frames.push(frame);
		const buf = ByteBuffer.createWithOpcode(GameServerOpcode.FRAME);
		buf.write1(this.player);
		writeFrame(buf, frame);
		this.websocket.send(buf.toArray());
	}

	//gravity
	private allAttractive() {
		for (let i = 0; i < this.gravity.length; i++) {
			this.attractive(this.gravity[i].pos, this.circle, this.gravity[i].force);
		}
	}

	private attractive(attractiveCenter: { x: number, y: number }, body: Matter.Body, gravityConstant: number) {
		const normal = { x: attractiveCenter.x - body.position.x, y: attractiveCenter.y - body.position.y }
		const distance = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
		const force = { x: gravityConstant * normal.x / (distance * + 1), y: gravityConstant * normal.y / (distance + 1) };
		Matter.Body.setVelocity(body, { x: body.velocity.x + force.x / 3, y: body.velocity.y + force.y / 3 })
	}

	private setGravity() {
		// // gravity object
		for (let i = 0; i < this.gravity.length; i++) {
			const attractive = Matter.Bodies.circle(
				this.gravity[i].pos.x,
				this.gravity[i].pos.y,
				this.gravity[i].radius,
				{
					isStatic: true,
					collisionFilter: {
						mask: this.lineCategory
					}
				});
			Matter.Composite.add(this.world, attractive);
		}
		console.log(this.gravity)
	}

	start() {
		Matter.Render.run(this.render);
		this.canvas.addEventListener("mousemove", (event: MouseEvent) => {
			const prevTimestamp = Date.now();
			const prevPointX = this.myPaddle.position.x;
			const prevPointY = this.myPaddle.position.y;
			const mousePos = this.calculateMousePos(event);
			this.myPaddleY = mousePos.y - this.PADDLE_RADIUS / 2;
			this.myPaddleX = mousePos.x - this.PADDLE_RADIUS / 2;
			Matter.Body.setPosition(this.myPaddle, { x: this.myPaddleX, y: this.myPaddleY });
			// 패들 중앙선 침범 금지~!
			if (this.myPaddle.position.y < this.HEIGHT / 2 + this.PADDLE_RADIUS) {
				Matter.Body.setPosition(this.myPaddle, {
					x: this.myPaddle.position.x,
					y: this.HEIGHT / 2 + this.PADDLE_RADIUS,
				});
			}
			const deltaT = Date.now() - prevTimestamp + 1;
			this.myPaddleVelocity = {
				x: (this.myPaddle.position.x - prevPointX) / deltaT,
				y: (this.myPaddle.position.y - prevPointY) / deltaT,
			};
		});
		//add Ellipse
		if (this.field === "ellipse") {
			this.setEllipse();
		}
		//중력객체 추가
		if (this.gravity.length > 0) {
			this.setGravity();
		}
		//add paddles
		Matter.Composite.add(this.world, this.myPaddle);
		Matter.Composite.add(this.world, this.counterPaddle);
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
			const size = this.frameQueue.length;
			if (size > 0) {
				for (let i = 0; i < size; i++) {
					if (this.frameQueue[i].resyncType === GameClientOpcode.RESYNC_PART) {
						const frame = this.frameQueue[i].frame;
						// setTimeout(() => {
						Matter.Body.setPosition(this.counterPaddle, this.player === 1 ? frame.paddle2.position : frame.paddle1.position);
						Matter.Body.setVelocity(this.counterPaddle, this.player === 1 ? frame.paddle2.velocity : frame.paddle1.velocity);
						this.player1Score = frame.player1Score;
						this.player2Score = frame.player2Score;
						// }, 1000 / (this.framesPerSecond * size) * i);
					}
					else if (this.frameQueue[i].resyncType === GameClientOpcode.RESYNC_ALL) {
						const frame = this.frameQueue[i].frame;
						// setTimeout(() => {
						Matter.Body.setPosition(this.counterPaddle, this.player === 1 ? frame.paddle2.position : frame.paddle1.position);
						Matter.Body.setVelocity(this.counterPaddle, this.player === 1 ? frame.paddle2.velocity : frame.paddle1.velocity);
						Matter.Body.setPosition(this.circle, frame.ball.position);
						Matter.Body.setVelocity(this.circle, frame.ball.velocity);
						this.player1Score = frame.player1Score;
						this.player2Score = frame.player2Score;
						// }, 1000 / (this.framesPerSecond * size) * i);
					}
				}
				console.log(size);
				this.frameQueue.splice(0, size);
			}
			const collided = Matter.Collision.collides(this.myPaddle, this.circle, 0) ?? Matter.Collision.collides(this.counterPaddle, this.circle, 0);
			const velocity = Matter.Body.getVelocity(this.circle);
			let paddle1Hit = false;
			let paddle2Hit = false;

			if (collided?.collided === true) {
				if (collided.bodyA.position.y > this.HEIGHT / 2) {
					paddle1Hit = true;
				}
				else {
					paddle2Hit = true;
				}
				this.reflection(collided.normal, this.circle)
				Matter.Body.setVelocity(this.circle, {
					x: this.circle.velocity.x + this.myPaddleVelocity.x / 8,
					y: this.circle.velocity.y + this.myPaddleVelocity.y / 8,
				});
				this.myPaddleVelocity = { x: 0, y: 0 };
			}
			//paddle2의 속도추가
			Matter.Body.setPosition(this.counterPaddle, { x: this.counterPaddle.position.x + this.counterPaddleVelocity.x, y: this.counterPaddle.position.y + this.counterPaddleVelocity.y })
			// 반사!
			// 타원 반사!
			if (this.field === "ellipse") {
				this.ellipseReflection();
			}
			this.wallReflection(velocity)
			//속도제한
			this.limitVelocity();
			//중력!
			this.allAttractive();

			//프레임 보내기
			this.sendFrame(paddle1Hit, paddle2Hit);

			//승점계산
			this.judgeWinner();
			this.drawScore();
		});
	}
}