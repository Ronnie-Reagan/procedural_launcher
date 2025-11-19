(() => {
    'use strict';

    const doc = document;
    const body = doc.body;

    while (body.firstChild) {
        body.removeChild(body.firstChild);
    }

    Object.assign(body.style, {
        margin: '0',
        background: '#01030a',
        color: '#f8f8ff',
        fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        overflow: 'hidden',
        userSelect: 'none',
    });

    const root = doc.createElement('div');
    Object.assign(root.style, {
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
    });
    body.appendChild(root);

    const canvas = doc.createElement('canvas');
    Object.assign(canvas.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
        cursor: 'crosshair',
    });
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const hud = doc.createElement('div');
    Object.assign(hud.style, {
        position: 'absolute',
        top: '1.25rem',
        left: '1.5rem',
        display: 'flex',
        gap: '1rem',
        padding: '0.85rem 1.15rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(6px)',
        alignItems: 'center',
        pointerEvents: 'none',
    });
    root.appendChild(hud);

    const createStat = (label) => {
        const wrapper = doc.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.fontSize = '0.8rem';
        wrapper.style.textTransform = 'uppercase';
        wrapper.style.letterSpacing = '0.08em';
        wrapper.style.color = 'rgba(255,255,255,0.7)';

        const value = doc.createElement('span');
        value.textContent = '0';
        value.style.fontSize = '1.2rem';
        value.style.fontWeight = '600';
        value.style.letterSpacing = 'normal';
        value.style.color = '#ffffff';

        wrapper.appendChild(doc.createTextNode(label));
        wrapper.appendChild(value);
        hud.appendChild(wrapper);
        return value;
    };

    const streakValue = createStat('Streak');
    const bestValue = createStat('Best');
    const lifetimeValue = createStat('Lifetime');

    const instructions = doc.createElement('div');
    Object.assign(instructions.style, {
        position: 'absolute',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '0.7rem 1.2rem',
        borderRadius: '999px',
        background: 'rgba(0, 0, 0, 0.4)',
        color: 'rgba(255,255,255,0.8)',
        fontSize: '0.9rem',
        letterSpacing: '0.03em',
        textAlign: 'center',
        pointerEvents: 'none',
        backdropFilter: 'blur(6px)',
    });
    instructions.textContent = 'Drag from the orb to aim, then release to arc into the glowing bucket.';
    root.appendChild(instructions);

    const statusBadge = doc.createElement('div');
    Object.assign(statusBadge.style, {
        position: 'absolute',
        top: '1.2rem',
        right: '1.5rem',
        padding: '0.6rem 1rem',
        borderRadius: '0.85rem',
        background: 'rgba(0, 0, 0, 0.55)',
        color: '#fff',
        fontWeight: '600',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        minWidth: '120px',
        textAlign: 'center',
        backdropFilter: 'blur(6px)',
    });
    statusBadge.textContent = 'Ready';
    root.appendChild(statusBadge);

    const randomRange = (min, max) => Math.random() * (max - min) + min;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const storage = {
        get(key) {
            try {
                return window.localStorage.getItem(key);
            } catch (err) {
                return null;
            }
        },
        set(key, value) {
            try {
                window.localStorage.setItem(key, value);
            } catch (err) {
                /* noop */
            }
        },
    };

    const persistenceKeys = {
        best: 'launcher_best',
        lifetime: 'launcher_lifetime',
    };

    const state = {
        width: window.innerWidth,
        height: window.innerHeight,
        groundY: 0,
        launchOrigin: { x: 0, y: 0 },
        gravity: 0.55,
        airDrag: 0.994,
        score: 0,
        best: Number(storage.get(persistenceKeys.best)) || 0,
        lifetime: Number(storage.get(persistenceKeys.lifetime)) || 0,
        lastTime: performance.now(),
        statusTimer: 0,
        bucket: {
            x: 0,
            y: 0,
            width: 120,
            depth: 100,
            wall: 14,
            color: '#38f',
            rim: '#fff8',
        },
        ball: {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 18,
            ready: true,
            launched: false,
            trail: [],
        },
        pointer: {
            active: false,
            pointerId: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
        },
        background: {
            top: '#04162b',
            bottom: '#092340',
            ridges: [],
            stars: [],
        },
        sparkles: [],
        floatingTexts: [],
    };

    const updateScoreboard = () => {
        streakValue.textContent = state.score.toString();
        bestValue.textContent = state.best.toString();
        lifetimeValue.textContent = state.lifetime.toString();
    };

    updateScoreboard();

    const setStatus = (text, duration = 2000) => {
        statusBadge.textContent = text;
        state.statusTimer = duration;
    };

    const rebuildBackdrop = () => {
        const hue = randomRange(180, 340);
        state.background.top = `hsl(${hue}, 70%, ${randomRange(12, 25)}%)`;
        state.background.bottom = `hsl(${(hue + randomRange(20, 60)) % 360}, 55%, ${randomRange(35, 55)}%)`;
        state.background.ridges = [];
        const layerCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < layerCount; i++) {
            const points = [];
            const segments = 6 + Math.floor(Math.random() * 5);
            for (let s = 0; s <= segments; s++) {
                const t = s / segments;
                const x = t * state.width;
                const offset = Math.sin(t * Math.PI * randomRange(0.8, 1.6)) * randomRange(20, 120);
                const baseY = state.height * (0.25 + 0.18 * i);
                points.push({ x, y: baseY + offset + randomRange(-30, 30) });
            }
            const layerHue = (hue + randomRange(-20, 20) + 360) % 360;
            const sat = clamp(50 - i * 8, 20, 60);
            const light = clamp(20 + i * 10, 15, 60);
            state.background.ridges.push({
                color: `hsla(${layerHue}, ${sat}%, ${light}%, 0.45)`,
                points,
            });
        }

        state.background.stars = [];
        const starCount = 40 + Math.floor(Math.random() * 60);
        for (let i = 0; i < starCount; i++) {
            state.background.stars.push({
                x: Math.random() * state.width,
                y: Math.random() * state.height * 0.55,
                size: randomRange(0.6, 2.2),
                alpha: randomRange(0.2, 0.8),
            });
        }
    };

    const randomizeBucket = () => {
        const minWidth = Math.max(70, state.width * 0.08);
        const maxWidth = Math.max(minWidth + 40, state.width * 0.2);
        state.bucket.width = randomRange(minWidth, maxWidth);
        state.bucket.depth = randomRange(Math.max(70, state.height * 0.14), Math.max(110, state.height * 0.22));
        state.bucket.wall = clamp(state.bucket.width * randomRange(0.12, 0.2), 10, 26);

        const maxX = state.width - state.bucket.width - 40;
        state.bucket.x = randomRange(state.width * 0.45, Math.max(state.width * 0.5, maxX));
        const topMin = Math.max(40, state.height * 0.1);
        const topLimit = Math.min(state.groundY - state.bucket.depth - 40, state.height * 0.65);
        const bucketMaxY = Math.max(topMin + 20, topLimit);
        state.bucket.y = randomRange(topMin, bucketMaxY);

        const hue = randomRange(150, 260);
        state.bucket.color = `hsla(${hue}, 78%, 55%, 0.5)`;
        state.bucket.rim = `hsl(${hue}, 90%, 70%)`;
    };

    // --- Bucket colliders: treat walls as thick line segments ---
    function getBucketColliders() {
        const b = state.bucket;

        const left = {
            type: 'line',
            x1: b.x,
            y1: b.y,
            x2: b.x,
            y2: b.y + b.depth,
            thickness: b.wall
        };

        const right = {
            type: 'line',
            x1: b.x + b.width,
            y1: b.y,
            x2: b.x + b.width,
            y2: b.y + b.depth,
            thickness: b.wall
        };

        const bottom = {
            type: 'line',
            x1: b.x,
            y1: b.y + b.depth,
            x2: b.x + b.width,
            y2: b.y + b.depth,
            thickness: b.wall * 0.65
        };

        return { left, right, bottom };
    }

    // --- Generic ball vs "thick line" collider ---
    function collideBallLine(ball, seg) {
        const vx = seg.x2 - seg.x1;
        const vy = seg.y2 - seg.y1;
        const wx = ball.x - seg.x1;
        const wy = ball.y - seg.y1;

        const lenSq = vx * vx + vy * vy || 1;
        const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1);

        const px = seg.x1 + vx * t;
        const py = seg.y1 + vy * t;

        const dx = ball.x - px;
        const dy = ball.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        const minDist = ball.radius + seg.thickness * 0.5;

        if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // push ball out of the wall
            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // reflect velocity (realistic-ish bounce)
            const dot = ball.vx * nx + ball.vy * ny;
            if (dot < 0) {
                ball.vx -= 1.6 * dot * nx;
                ball.vy -= 1.6 * dot * ny;
                ball.vx *= 0.85;
                ball.vy *= 0.85;
            }
            return true;
        }
        return false;
    }

    const repositionBall = () => {
        state.ball.radius = clamp(state.width * 0.018, 14, 22);
        state.launchOrigin.y = state.groundY - state.ball.radius * 0.5;
        state.ball.x = state.launchOrigin.x + randomRange(-3, 3);
        state.ball.y = state.launchOrigin.y + randomRange(-3, 3);
        state.ball.vx = 0;
        state.ball.vy = 0;
        state.ball.ready = true;
        state.ball.launched = false;
        state.ball.trail = [];
    };

    const resizeCanvas = () => {
        state.width = window.innerWidth;
        state.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(state.width * dpr);
        canvas.height = Math.floor(state.height * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        state.groundY = state.height - Math.max(100, state.height * 0.15);
        state.launchOrigin.x = state.width * 0.18;
        state.launchOrigin.y = state.groundY - state.ball.radius * 0.5;

        if (!state.ball.launched) {
            repositionBall();
        }
        rebuildBackdrop();
        randomizeBucket();
    };

    window.addEventListener('resize', () => {
        resizeCanvas();
        setStatus('Resized Arena', 1200);
    });

    resizeCanvas();

    const pointerToCanvas = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * state.width;
        const y = ((event.clientY - rect.top) / rect.height) * state.height;
        return { x, y };
    };

    const endPointer = () => {
        if (state.pointer.pointerId !== null) {
            try {
                canvas.releasePointerCapture(state.pointer.pointerId);
            } catch (err) {
                /* ignore */
            }
        }
        state.pointer.active = false;
        state.pointer.pointerId = null;
    };

    canvas.addEventListener('pointerdown', (event) => {
        if (!state.ball.ready) {
            return;
        }
        const pos = pointerToCanvas(event);
        const dist = Math.hypot(pos.x - state.ball.x, pos.y - state.ball.y);
        if (dist > state.ball.radius + 40) {
            return;
        }
        state.pointer.active = true;
        state.pointer.pointerId = event.pointerId;
        state.pointer.startX = pos.x;
        state.pointer.startY = pos.y;
        state.pointer.currentX = pos.x;
        state.pointer.currentY = pos.y;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!state.pointer.active) {
            return;
        }
        const pos = pointerToCanvas(event);
        state.pointer.currentX = pos.x;
        state.pointer.currentY = pos.y;
        event.preventDefault();
    });

    const launchBall = () => {
        const { startX, startY, currentX, currentY } = state.pointer;
        const dx = startX - currentX;
        const dy = startY - currentY;
        const distance = Math.hypot(dx, dy);
        if (distance < 6) {
            setStatus('Pull back further', 800);
            return false;
        }
        const maxDrag = Math.min(state.width, state.height) * 0.45;
        const clampedDrag = Math.min(distance, maxDrag);
        const strength = clampedDrag / maxDrag;
        const maxSpeed = Math.max(state.width, state.height) * 0.03 + 6;
        const speed = strength * maxSpeed;
        const nx = (dx / distance) * 2;
        const ny = (dy / distance) * 2;
        state.ball.vx = nx * speed;
        state.ball.vy = ny * speed;
        state.ball.launched = true;
        state.ball.ready = false;
        state.ball.trail = [];
        setStatus('Launched!', 900);
        return true;
    };

    canvas.addEventListener('pointerup', (event) => {
        if (!state.pointer.active) {
            return;
        }
        const launched = launchBall();
        endPointer();
        if (!launched) {
            state.ball.ready = true;
        }
        event.preventDefault();
    });

    canvas.addEventListener('pointercancel', () => {
        endPointer();
    });

    const spawnSparkles = (x, y, count, color) => {
        for (let i = 0; i < count; i++) {
            state.sparkles.push({
                x,
                y,
                vx: randomRange(-1.5, 1.5),
                vy: randomRange(-2, -0.2),
                life: randomRange(500, 1200),
                color,
                size: randomRange(2, 5),
            });
        }
    };

    const addFloatingText = (text, x, y, color = '#fff') => {
        state.floatingTexts.push({
            text,
            x,
            y,
            life: 1200,
            color,
            vy: randomRange(-0.2, -0.05),
        });
    };

    const finishAttempt = (success) => {
        if (success) {
            state.score += 1;
            state.lifetime += 1;
            if (state.score > state.best) {
                state.best = state.score;
                storage.set(persistenceKeys.best, String(state.best));
            }
            storage.set(persistenceKeys.lifetime, String(state.lifetime));
            updateScoreboard();
            spawnSparkles(
                state.bucket.x + state.bucket.width / 2,
                state.bucket.y + state.bucket.depth / 2,
                30,
                state.bucket.rim
            );
            addFloatingText('Nice!', state.bucket.x + state.bucket.width / 2, state.bucket.y, '#b2f5ff');
            setStatus('Bucket!' + (state.score % 5 === 0 ? ' Hot streak!' : ''), 1600);
            randomizeBucket();
            rebuildBackdrop();
        } else {
            if (state.score !== 0) {
                addFloatingText('Streak reset', state.ball.x, state.ball.y, '#ffb3c1');
            }
            state.score = 0;
            updateScoreboard();
            setStatus('Missed', 1200);
        }
        repositionBall();
    };

    const updateSparkles = (deltaMs) => {
        state.sparkles = state.sparkles.filter((sparkle) => {
            sparkle.life -= deltaMs;
            if (sparkle.life <= 0) {
                return false;
            }
            const factor = deltaMs / 16;
            sparkle.x += sparkle.vx * factor;
            sparkle.y += sparkle.vy * factor;
            sparkle.vy += 0.02 * factor;
            return true;
        });
    };

    const updateFloatingTexts = (deltaMs) => {
        state.floatingTexts = state.floatingTexts.filter((text) => {
            text.life -= deltaMs;
            if (text.life <= 0) {
                return false;
            }
            const factor = deltaMs / 16;
            text.y += text.vy * factor * 12;
            text.vy -= 0.0007 * factor;
            return true;
        });
    };

    const updateBall = (delta) => {
        const ball = state.ball;
        if (!ball.launched) {
            return;
        }

        // physics integration
        ball.vy += state.gravity * delta;
        ball.vx *= Math.pow(state.airDrag, delta);
        ball.vy *= Math.pow(state.airDrag, delta);
        ball.x += ball.vx * delta;
        ball.y += ball.vy * delta;

        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 60) {
            ball.trail.shift();
        }

        // ground collision
        const ground = state.groundY;
        if (ball.y + ball.radius >= ground) {
            ball.y = ground - ball.radius;
            if (Math.abs(ball.vy) < 1.5) {
                ball.vy = 0;
                ball.vx *= 0.7;
                finishAttempt(false);
                return;
            }
            ball.vy *= -0.45;
            ball.vx *= 0.8;
        }

        // world bounds
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx *= -0.5;
        } else if (ball.x + ball.radius > state.width) {
            ball.x = state.width - ball.radius;
            ball.vx *= -0.5;
        }

        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy *= -0.45;
        }

        // bucket wall collisions (realistic basketball: can bounce off and still score later)
        const colliders = getBucketColliders();
        collideBallLine(ball, colliders.left);
        collideBallLine(ball, colliders.right);
        collideBallLine(ball, colliders.bottom);

        // fail if ball escapes the arena entirely
        const failBorder = 120;
        if (
            ball.x < -failBorder ||
            ball.x > state.width + failBorder ||
            ball.y > state.height + failBorder
        ) {
            finishAttempt(false);
            return;
        }

        // --- scoring zone respecting walls and ball radius ---
        // Define interior zone inside the bucket walls
        const b = state.bucket;
        const r = ball.radius;

        // shrink horizontally by wall and radius so the ball fully fits
        const innerLeft = b.x + b.wall * 0.6 + r * 0.4;
        const innerRight = b.x + b.width - b.wall * 0.6 - r * 0.4;

        // top is just below rim; bottom is above the physical bottom so you must "fall in"
        const innerTop = b.y + b.wall + r * 0.3;
        const innerBottomGoal = b.y + b.depth - b.wall - r * 0.8;

        const inX = ball.x > innerLeft && ball.x < innerRight;
        const inY = ball.y > innerTop && ball.y < innerBottomGoal;

        // Option C: realistic basketball.
        // Ball can bounce off walls and bottom; any *downward* pass through a safe interior band scores.
        if (ball.vy > 0 && inX && inY) {
            finishAttempt(true);
            return;
        }
    };

    const drawBackground = () => {
        const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
        gradient.addColorStop(0, state.background.top);
        gradient.addColorStop(1, state.background.bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, state.width, state.height);

        ctx.save();
        state.background.stars.forEach((star) => {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        state.background.ridges.forEach((layer, index) => {
            ctx.fillStyle = layer.color;
            ctx.beginPath();
            ctx.moveTo(0, state.height);
            layer.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
            ctx.lineTo(state.width, state.height);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = `rgba(255,255,255,${0.03 * (index + 1)})`;
            layer.points.forEach((pt) => {
                ctx.fillRect(pt.x, pt.y - 1, 3, 2);
            });
        });
    };

    const drawGround = () => {
        const groundHeight = state.height - state.groundY;
        const grd = ctx.createLinearGradient(0, state.groundY - 40, 0, state.height);
        grd.addColorStop(0, 'rgba(10, 10, 18, 0)');
        grd.addColorStop(1, 'rgba(10, 10, 18, 0.95)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, state.groundY - 40, state.width, groundHeight + 40);

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        const step = 30;
        for (let x = 0; x < state.width; x += step) {
            ctx.fillRect(x, state.groundY - 4, step * 0.5, 2);
        }
    };

    const drawLaunchPad = () => {
        ctx.save();
        const baseX = state.launchOrigin.x;
        const baseY = state.groundY;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX - 35, baseY + 8);
        ctx.lineTo(baseX + 35, baseY + 8);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(baseX, baseY + 2, 24, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
    };

    const drawBucket = () => {
        ctx.save();
        ctx.lineWidth = state.bucket.wall;
        ctx.strokeStyle = state.bucket.rim;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(state.bucket.x, state.bucket.y);
        ctx.lineTo(state.bucket.x, state.bucket.y + state.bucket.depth);
        ctx.moveTo(state.bucket.x + state.bucket.width, state.bucket.y);
        ctx.lineTo(state.bucket.x + state.bucket.width, state.bucket.y + state.bucket.depth);
        ctx.stroke();

        ctx.lineWidth = state.bucket.wall * 0.65;
        ctx.beginPath();
        ctx.moveTo(state.bucket.x, state.bucket.y + state.bucket.depth + 6);
        ctx.lineTo(state.bucket.x + state.bucket.width, state.bucket.y + state.bucket.depth + 6);
        ctx.stroke();

        ctx.fillStyle = state.bucket.color;
        ctx.fillRect(
            state.bucket.x + state.bucket.wall * 0.4,
            state.bucket.y + state.bucket.wall * 0.5,
            state.bucket.width - state.bucket.wall * 0.8,
            state.bucket.depth - state.bucket.wall + 10
        );
        ctx.restore();
    };

    const drawBall = () => {
        const ball = state.ball;
        ctx.save();
        const gradient = ctx.createRadialGradient(
            ball.x - ball.radius * 0.4,
            ball.y - ball.radius * 0.5,
            ball.radius * 0.2,
            ball.x,
            ball.y,
            ball.radius
        );
        gradient.addColorStop(0, '#fefefe');
        gradient.addColorStop(1, '#85a9ff');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const drawTrail = () => {
        if (!state.ball.trail.length) {
            return;
        }
        ctx.save();
        ctx.strokeStyle = 'rgba(130,180,255,0.3)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < state.ball.trail.length; i++) {
            const t = state.ball.trail[i];
            if (i === 0) {
                ctx.moveTo(t.x, t.y);
            } else {
                ctx.lineTo(t.x, t.y);
            }
        }
        ctx.stroke();
        ctx.restore();
    };

    const drawAim = () => {
        if (!state.pointer.active) {
            return;
        }
        const { startX, startY, currentX, currentY } = state.pointer;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const drawSparkles = () => {
        ctx.save();
        state.sparkles.forEach((sparkle) => {
            ctx.globalAlpha = clamp(sparkle.life / 1200, 0, 1);
            ctx.fillStyle = sparkle.color;
            ctx.beginPath();
            ctx.arc(
                sparkle.x,
                sparkle.y,
                sparkle.size * (sparkle.life / 1200 + 0.2),
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
        ctx.restore();
    };

    const drawFloatingTexts = () => {
        ctx.save();
        ctx.font = '700 18px "Inter", system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        state.floatingTexts.forEach((floating) => {
            const alpha = clamp(floating.life / 1200, 0, 1);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = floating.color;
            ctx.fillText(floating.text, floating.x, floating.y);
        });
        ctx.restore();
    };

    const render = () => {
        drawBackground();
        drawGround();
        drawLaunchPad();
        drawBucket();
        drawTrail();
        drawBall();
        drawAim();
        drawSparkles();
        drawFloatingTexts();
    };

    const update = (timestamp) => {
        const deltaMs = timestamp - state.lastTime;
        const delta = Math.min(deltaMs / (1000 / 60), 2.5);
        state.lastTime = timestamp;

        if (state.statusTimer > 0) {
            state.statusTimer -= deltaMs;
            if (state.statusTimer <= 0) {
                statusBadge.textContent = '';
            }
        }

        updateSparkles(deltaMs);
        updateFloatingTexts(deltaMs);
        updateBall(delta);
    };

    const tick = (timestamp) => {
        update(timestamp);
        render();
        requestAnimationFrame(tick);
    };

    setStatus('Drag + release to score!', 3200);
    requestAnimationFrame(tick);
})();
