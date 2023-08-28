var Example = Example || {};

Example.car = function () {
	var Engine = Matter.Engine,
		Render = Matter.Render,
		Runner = Matter.Runner,
		Composites = Matter.Composites,
		Composite = Matter.Composite,
		Events = Matter.Events,
		Bodies = Matter.Bodies,
		Body = Matter.Body,
		Collision = Matter.Collision;

	// create engine
	var engine = Engine.create({ gravity: { x: 0, y: 0 } }),
		world = engine.world;

	// create renderer
	var render = Render.create({
		element: document.body,
		engine: engine,
		options: {
			width: 1000,
			height: 1920,
			showAngleIndicator: true,
			showCollisions: true
		}
	});

	var canvas = render.canvas;
	var paddleX = 50,
		paddleY = 50;
	var paddle = Bodies.circle(paddleX, paddleY, 80, { isStatic: true, mass: 0, density: 0 });
	function calculateMousePos(event) {
		var rect = canvas.getBoundingClientRect();
		var mouseX = event.clientX - rect.left;
		var mouseY = event.clientY - rect.top;
		return {
			x: mouseX,
			y: mouseY
		}
	}
	canvas.addEventListener('mousemove',
		function (event) {
			let mousePos = calculateMousePos(event);
			paddleY = mousePos.y - 15;
			paddleX = mousePos.x - 15;
			// console.log("paddleX : ", paddleX);
			// console.log("paddleY : ", paddleY);
			Body.setPosition(paddle, { x: paddleX, y: paddleY });
		});
	Render.run(render);
	Composite.add(world, paddle);




	// create runner
	var runner = Runner.create();
	Runner.run(runner, engine);

	Events.on(runner, 'tick', (e) => {
		const collided = Collision.collides(paddle, circle);
		const velocity = Body.getVelocity(circle);
		if (collided?.collided === true) {
			const theta = Math.atan2(collided.normal.y, collided.normal.x);
			const alpha = Math.atan2(velocity.y, velocity.x);
			const newVx = velocity.x * Math.cos(2 * theta - 2 * alpha) - velocity.y * Math.sin(2 * theta - 2 * alpha);
			const newVy = velocity.x * Math.sin(2 * theta - 2 * alpha) + velocity.y * Math.cos(2 * theta - 2 * alpha);
			Body.setVelocity(circle, { x: newVx * -1.1, y: newVy * -1.1 });
		}
		if (circle.position.x < 25) {
			Body.setPosition(circle, { x: 25, y: circle.position.y })
			Body.setVelocity(circle, { x: velocity.x * -1, y: velocity.y * 1 });
		}
		else if (circle.position.x > 1000 - 25) {
			Body.setPosition(circle, { x: 975, y: circle.position.y })
			Body.setVelocity(circle, { x: velocity.x * -1, y: velocity.y * 1 });
		}
		if (circle.position.y < 25) {
			Body.setPosition(circle, { x: circle.position.x, y: 25 })
			Body.setVelocity(circle, { x: velocity.x * 1, y: velocity.y * -1 });
		}
		else if (circle.position.y > 1920 - 25) {
			Body.setPosition(circle, { x: circle.position.x, y: 1895 })
			Body.setVelocity(circle, { x: velocity.x * 1, y: velocity.y * -1 });
		}
	});

	var circle = Bodies.circle(500, 960, 50, { frictionStatic: 0, frictionAir: 0, friction: 0 });
	Body.setInertia(circle, 0.00001)
	Body.setVelocity(circle, { x: 10, y: 10 });

	// var leftWall = Bodies.rectangle(5, 960, 10, 1920, { isStatic: true }),
	// 	rightWall = Bodies.rectangle(995, 960, 10, 1920, { isStatic: true });
	// var topWall = Bodies.rectangle(500, 5, 990, 10, { isStatic: true }),
	// 	bottomWall = Bodies.rectangle(500, 1915, 990, 10, { isStatic: true });
	// Composite.add(world, [
	// 	leftWall,
	// 	rightWall,
	// 	topWall,
	// 	bottomWall
	// ]);
	Composite.add(world, circle);


	// see car function defined later in this file
	// var scale = 0.9;
	// var car1 = Example.car.car(150, 100, 150 * scale, 30 * scale, 30 * scale);
	// Composite.add(world, car1);

	// scale = 0.8;
	// Composite.add(world, Example.car.car(350, 300, 150 * scale, 30 * scale, 30 * scale));

	// Composite.add(world, [
	// 	Bodies.rectangle(200, 150, 400, 20, { isStatic: true, angle: Math.PI * 0.06, render: { fillStyle: '#060a19' } }),
	// 	Bodies.rectangle(500, 350, 650, 20, { isStatic: true, angle: -Math.PI * 0.06, render: { fillStyle: '#060a19' } }),
	// 	Bodies.rectangle(300, 560, 600, 20, { isStatic: true, angle: Math.PI * 0.04, render: { fillStyle: '#060a19' } })
	// ]);

	// // add mouse control
	// var mouse = Mouse.create(render.canvas),
	// 	mouseConstraint = MouseConstraint.create(engine, {
	// 		mouse: mouse,
	// 		constraint: {
	// 			stiffness: 0.2,
	// 			render: {
	// 				visible: false
	// 			}
	// 		},
	// 		// element: {

	// 		// }
	// 	});

	// Composite.add(world, mouseConstraint);

	// // keep the mouse in sync with rendering
	// render.mouse = mouse;

	// fit the render viewport to the scene
	Render.lookAt(render, {
		min: { x: 0, y: 0 },
		max: { x: 1000, y: 1920 }
	});

	// context for MatterTools.Demo
	return {
		engine: engine,
		runner: runner,
		render: render,
		canvas: render.canvas,
		stop: function () {
			Matter.Render.stop(render);
			Matter.Runner.stop(runner);
		}
	};
};

Example.car.title = 'Car';
Example.car.for = '>=0.14.2';

/**
* Creates a composite with simple car setup of bodies and constraints.
* @method car
* @param {number} xx
* @param {number} yy
* @param {number} width
* @param {number} height
* @param {number} wheelSize
* @return {composite} A new composite car body
*/
Example.car.car = function (xx, yy, width, height, wheelSize) {
	var Body = Matter.Body,
		Bodies = Matter.Bodies,
		Composite = Matter.Composite,
		Constraint = Matter.Constraint;

	var group = Body.nextGroup(true),
		wheelBase = 20,
		wheelAOffset = -width * 0.5 + wheelBase,
		wheelBOffset = width * 0.5 - wheelBase,
		wheelYOffset = 0;

	var car = Composite.create({ label: 'Car' }),
		body = Bodies.rectangle(xx, yy, width, height, {
			collisionFilter: {
				group: group
			},
			chamfer: {
				radius: height * 0.5
			},
			density: 0.0002
		});

	var wheelA = Bodies.circle(xx + wheelAOffset, yy + wheelYOffset, wheelSize, {
		collisionFilter: {
			group: group
		},
		friction: 0.8
	});

	var wheelB = Bodies.circle(xx + wheelBOffset, yy + wheelYOffset, wheelSize, {
		collisionFilter: {
			group: group
		},
		friction: 0.8
	});

	var axelA = Constraint.create({
		bodyB: body,
		pointB: { x: wheelAOffset, y: wheelYOffset },
		bodyA: wheelA,
		stiffness: 1,
		length: 0
	});

	var axelB = Constraint.create({
		bodyB: body,
		pointB: { x: wheelBOffset, y: wheelYOffset },
		bodyA: wheelB,
		stiffness: 1,
		length: 0
	});

	Composite.addBody(car, body);
	Composite.addBody(car, wheelA);
	Composite.addBody(car, wheelB);
	Composite.addConstraint(car, axelA);
	Composite.addConstraint(car, axelB);

	return car;
};

if (typeof module !== 'undefined') {
	module.exports = Example.car;
}

Example.car();