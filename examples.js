
function computeLaunchVelocity() {
    const anchorX = state.launchOrigin.x;
    const anchorY = state.launchOrigin.y;
    const dx = anchorX - state.ball.x;
    const dy = anchorY - state.ball.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 6) {
        return null;
    }

    const maxDrag = getMaxDragDistance();
    const strength = clamp(distance / maxDrag, 0, 1);
    const maxSpeed = Math.max(state.width, state.height) * 0.04 + 4;
    const speed = strength * maxSpeed;

    const inv = 1 / distance;
    return {
        vx: dx * inv * speed,
        vy: dy * inv * speed,
        speed
    };
}

const launchBall = () => {
    const result = computeLaunchVelocity();
    if (!result) {
        setStatus('Pull back further', 800);
        return false;
    }

    state.ball.vx = result.vx;
    state.ball.vy = result.vy;
    state.ball.launched = true;
    state.ball.ready = false;
    state.ball.trail = [];
    state.pointer.tension = 0;
    setStatus('Launched!', 900);
    return true;
};

const drawTrajectoryPreview = () => {
    // Only show while aiming
    if (!state.pointer.active || !state.ball.ready || state.ball.launched) {
        return;
    }

    const launch = computeLaunchVelocity();
    if (!launch) {
        return;
    }

    const ball = state.ball;
    const ground = state.groundY;

    // Start sim where the real launch conceptually begins
    const simBall = {
        x: state.launchOrigin.x,
        y: ground - ball.radius - 1,
        vx: launch.vx,
        vy: launch.vy,
        radius: ball.radius,
    };

    const bucketColliders = getBucketColliders();

    const points = [];
    const steps = 200; // how long to predict
    const dt = 1;      // matches your "per frame" style
    const dragFactor = Math.pow(state.airDrag, dt);

    for (let i = 0; i < steps; i++) {
        // 1. Gravity
        simBall.vy += state.gravity * dt;

        // 2. Integrate position
        simBall.x += simBall.vx * dt;
        simBall.y += simBall.vy * dt;

        // 3. Ground
        if (simBall.y + simBall.radius >= ground) {
            const impact = Math.abs(simBall.vy);
            simBall.y = ground - simBall.radius;

            // If it is basically done bouncing, stop the preview here
            if (impact < state.MIN_BOUNCE * 0.9) {
                simBall.vy = 0;
                simBall.vx *= 0.7;
                points.push({ x: simBall.x, y: simBall.y });
                break;
            }

            // Bounce off ground
            simBall.vy = -simBall.vy * state.REST;
            simBall.vx *= 0.8;
        }

        // 4. Left/right screen walls
        if (simBall.x - simBall.radius < 0) {
            const impact = Math.abs(simBall.vx);
            simBall.x = simBall.radius;

            if (impact > state.MIN_BOUNCE) {
                simBall.vx = -simBall.vx * state.SIDE_REST;
            } else {
                simBall.vx = 0;
            }
        } else if (simBall.x + simBall.radius > state.width) {
            const impact = Math.abs(simBall.vx);
            simBall.x = state.width - simBall.radius;

            if (impact > state.MIN_BOUNCE) {
                simBall.vx = -simBall.vx * state.SIDE_REST;
            } else {
                simBall.vx = 0;
            }
        }

        // 5. Ceiling
        if (simBall.y - simBall.radius < 0) {
            const impact = Math.abs(simBall.vy);
            simBall.y = simBall.radius;

            if (impact > state.MIN_BOUNCE) {
                simBall.vy = -simBall.vy * state.REST;
            } else {
                simBall.vy = 0;
            }
        }

        // 6. Bucket walls and bottom, using your existing colliders
        // No sound for preview, so onImpact is null
        collideBallLine(simBall, bucketColliders.left, null);
        collideBallLine(simBall, bucketColliders.right, null);
        collideBallLine(simBall, bucketColliders.bottom, null);

        // 7. Air drag
        simBall.vx *= dragFactor;
        simBall.vy *= dragFactor;

        // Record points for drawing
        if (i % 2 === 0) {
            points.push({ x: simBall.x, y: simBall.y });
        }

        // Stop if we go way off screen
        if (
            simBall.x < -simBall.radius * 2 ||
            simBall.x > state.width + simBall.radius * 2 ||
            simBall.y > state.height + simBall.radius * 2
        ) {
            break;
        }
    }

    if (!points.length) return;

    // Draw the predicted path
    ctx.save();

    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(191,219,254,0.8)';

    ctx.beginPath();
    ctx.moveTo(state.launchOrigin.x, ground - ball.radius - 1);
    for (let i = 0; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Mark the final predicted position (often in or near the bucket)
    const last = points[points.length - 1];
    ctx.fillStyle = 'rgba(191,219,254,0.9)';
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
};
