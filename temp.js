const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 300;
canvas.height = 300;
// Draw the ellipse
ctx.beginPath();
ctx.ellipse(100, 100, 50, 75, Math.PI / 4, 0, 2 * Math.PI);
ctx.stroke();