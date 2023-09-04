import { Matter } from "matter-js";
const WIDTH = 1000,
	HEIGHT = 1920,
	BALL_RADIUS = 36,
	PADDLE_RADIUS = 80,
	WIN_SCORE = 10;

let player1Score = 0,
	player2Score = 0;

let paddle1Velocity = { x: 0, y: 0 };

const lineCategory = 0x0002;

const Engine = Matter.Engine,
	Render = Matter.Render,
	Runner = Matter.Runner,
	Composites = Matter.Composites,
	Events = Matter.Events,
	Composite = Matter.Composite,
	Bodies = Matter.Bodies,
	Body = Matter.Body,
	Collision = Matter.Collision;

// create engine
const engine = Engine.create({ gravity: { x: 0, y: 0 } }),
	world = engine.world;

// create renderer
const render = Render.create({
	element: document.body,
	engine: engine,
	options: {
		width: WIDTH,
		height: HEIGHT,
		showAngleIndicator: true,
		showCollisions: true
	}
});
const canvas = render.canvas;
const canvasContext = canvas.getContext('2d');
canvasContext.font = '30px arial';
Render.run(render);

// Player1 paddle
let paddle1X = WIDTH / 2,
	paddle1Y = HEIGHT - BALL_RADIUS - 50;
const paddle1 = Bodies.circle(paddle1X, paddle1Y, PADDLE_RADIUS, {
	isStatic: true,
	restitution: 1, frictionStatic: 0, frictionAir: 0, friction: 0,
});
function calculateMousePos(event: any) {
	var rect = canvas.getBoundingClientRect();
	var mouseX = event.clientX - rect.left;
	var mouseY = event.clientY - rect.top;
	return {
		x: mouseX,
		y: mouseY
	}
}
canvas.addEventListener('mousemove',
	function (event: any) {
		const prevTimestamp = Date.now();
		const prevPointX = paddle1.position.x;
		const prevPointY = paddle1.position.y;
		let mousePos = calculateMousePos(event);
		paddle1Y = mousePos.y - PADDLE_RADIUS / 2;
		paddle1X = mousePos.x - PADDLE_RADIUS / 2;
		Body.setPosition(paddle1, { x: paddle1X, y: paddle1Y });
		//패들 중앙선 침범 금지~!
		if (paddle1.position.y < HEIGHT / 2 + PADDLE_RADIUS) {
			Body.setPosition(paddle1, { x: paddle1.position.x, y: HEIGHT / 2 + PADDLE_RADIUS })
		}
		const deltaT = Date.now() - prevTimestamp + 1;
		paddle1Velocity = { x: (paddle1.position.x - prevPointX) / deltaT, y: (paddle1.position.y - prevPointY) / deltaT };
	});
Composite.add(world, paddle1);


// Player2 paddle
let paddle2X = WIDTH / 2,
	paddle2Y = BALL_RADIUS + 50;
const paddle2 = Bodies.circle(paddle2X, paddle2Y, PADDLE_RADIUS, {
	isStatic: true,
	restitution: 1, frictionStatic: 0, frictionAir: 0, friction: 0,
});
Composite.add(world, paddle2);

//add line
Composite.add(world, Bodies.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, 2, {
	isStatic: true, collisionFilter: {
		mask: lineCategory
	}
}))


// create runner
const runner = Runner.create();
Runner.run(runner, engine);

// Event On!
Events.on(runner, 'tick', (_e: any) => {
	const collided = Collision.collides(paddle1, circle) ?? Collision.collides(paddle2, circle);
	const velocity = Body.getVelocity(circle);
	if (collided?.collided === true) {
		if (collided.normal.x * velocity.x + collided.normal.y * velocity.y >= 0) {
			const theta = Math.atan2(collided.normal.y, collided.normal.x);
			const alpha = Math.atan2(velocity.y, velocity.x);
			const newVx = velocity.x * Math.cos(2 * theta - 2 * alpha) - velocity.y * Math.sin(2 * theta - 2 * alpha);
			const newVy = velocity.x * Math.sin(2 * theta - 2 * alpha) + velocity.y * Math.cos(2 * theta - 2 * alpha);
			Body.setVelocity(circle, { x: newVx * -1.1, y: newVy * -1.1 });
		}
		Body.setVelocity(circle, { x: circle.velocity.x + paddle1Velocity.x / 4, y: circle.velocity.y + paddle1Velocity.y / 4 });
		paddle1Velocity = { x: 0, y: 0 };
	}
	//반사!
	if (circle.position.x < BALL_RADIUS) {
		Body.setPosition(circle, { x: BALL_RADIUS, y: circle.position.y })
		Body.setVelocity(circle, { x: velocity.x * -1, y: velocity.y * 1 });
	}
	else if (circle.position.x > WIDTH - BALL_RADIUS) {
		Body.setPosition(circle, { x: WIDTH - BALL_RADIUS, y: circle.position.y })
		Body.setVelocity(circle, { x: velocity.x * -1, y: velocity.y * 1 });
	}
	//점수 겟또
	if (circle.position.y < BALL_RADIUS) {
		player1Score++;
		Body.setPosition(circle, { x: WIDTH / 2, y: HEIGHT / 2 });
		Body.setVelocity(circle, { x: -15, y: -15 });
		Body.setAngularVelocity(circle, 0);
	}
	else if (circle.position.y > HEIGHT - BALL_RADIUS) {
		player2Score++;
		Body.setPosition(circle, { x: WIDTH / 2, y: HEIGHT / 2 })
		Body.setVelocity(circle, { x: 15, y: 15 });
		Body.setAngularVelocity(circle, 0);
	}
	if (player1Score >= WIN_SCORE) {
		canvasContext.fillText("Player 1 Wins!", WIDTH / 2 - 100, HEIGHT / 2);
		Render.stop(render);
		Runner.stop(runner);
	}
	else if (player2Score >= WIN_SCORE) {
		canvasContext.fillText("Player 2 Wins!", WIDTH / 2 - 100, HEIGHT / 2);
		Render.stop(render);
		Runner.stop(runner);
	}
	//속도제한
	if (circle.velocity.x > 35) {
		Body.setVelocity(circle, { x: 35, y: circle.velocity.y });
	}
	if (circle.velocity.y > 35) {
		Body.setVelocity(circle, { x: circle.velocity.x, y: 35 });
	}
	canvasContext.fillText(`Player 2 score: ` + player2Score + `/${WIN_SCORE}`, WIDTH / 2 - 150, 25);
	canvasContext.fillText(`Player 1 score: ` + player1Score + `/${WIN_SCORE}`, WIDTH / 2 - 150, 1900);
});

//ball
const circle = Bodies.circle(500, 960, BALL_RADIUS, {
	frictionStatic: 0, frictionAir: 0, friction: 0,
	restitution: 1
});
Body.setInertia(circle, 0.00001);
Body.setVelocity(circle, { x: 15, y: 15 });
Composite.add(world, circle);


Render.lookAt(render, {
	min: { x: 0, y: 0 },
	max: { x: WIDTH, y: HEIGHT }
});