const video = document.getElementById('webcamVideo');
const playerCanvas = document.getElementById('playerCanvas');
const enemyCanvas = document.getElementById('enemyCanvas');
const playerCtx = playerCanvas.getContext('2d');
const enemyCtx = enemyCanvas.getContext('2d');

let modelsLoaded = false;
let stream = null;

// BATTLE STATE
const state = {
    player: {
        hp: 100,
        landmarks: null,
        captured: false,
        tortures: 0
    },
    enemy: {
        hp: 100,
        landmarks: null,
        loaded: false,
        tortures: 0
    },
    turn: 'player' // player, enemy
};

// ASSETS
// ASSETS
const assets = {
    pimple: new Image(),
    drool: new Image(),
    snot: new Image(),
    unibrow: new Image(),
    poop: new Image(),
    slapMark: new Image(),
    slapHand: 'hand_slap.png', // URL for DOM
    slapImpact: 'impact_slap.png' // URL for DOM
};
assets.pimple.src = 'fix_bisul.png';
assets.drool.src = 'fix_drool.png';
assets.snot.src = 'fix_snot.png';
assets.unibrow.src = 'unibrow.png';
assets.poop.src = 'poop_splat.png';
assets.slapMark.src = 'mark_handprint_final.png';

// --- INITIALIZATION ---
async function init() {
    console.log("Loading Models...");

    const status = document.getElementById('modelStatus');

    // Helper to update status
    const setStatus = (msg, color = '#333') => {
        status.textContent = msg;
        status.style.background = color;
        console.log(msg);
    };

    const loadWithRetry = async () => {
        // STRATEGY 1: LOCAL
        try {
            setStatus("⏳ Memuat Model Lokal (TinyFace)...");
            await faceapi.nets.tinyFaceDetector.loadFromUri('./weights');

            setStatus("⏳ Memuat Model Lokal (Landmarks)...");
            await faceapi.nets.faceLandmark68Net.loadFromUri('./weights');

            return true; // Success
        } catch (localErr) {
            console.warn("Local load failed:", localErr);
            setStatus("⚠️ Lokal Gagal. Mencoba Online...", "#553300");

            // STRATEGY 2: CDN FALLBACK
            try {
                const cdnUrl = 'https://justadudewhohacks.github.io/face-api.js/models';
                await faceapi.nets.tinyFaceDetector.loadFromUri(cdnUrl);
                await faceapi.nets.faceLandmark68Net.loadFromUri(cdnUrl);
                return true;
            } catch (cdnErr) {
                console.error("Online load failed:", cdnErr);
                throw new Error("Semua metode gagal. Cek weights folder atau internet.");
            }
        }
    };

    try {
        await loadWithRetry();

        modelsLoaded = true;
        setStatus("✅ AI SIAP! Silakan Main.", "#004400");
        status.classList.remove('loading');
        status.classList.add('ready');
        status.style.border = "1px solid #00ff00";

        checkReady();
    } catch (e) {
        setStatus("❌ ERROR FATAL: " + e.message, "#500");
        alert("Gagal memuat AI. Coba refresh atau cek koneksi!");
    }
}

// --- WEBCAM LOGIC ---
const cameraBtn = document.getElementById('cameraBtn');
const captureBtn = document.getElementById('captureBtn');
const retakeBtn = document.getElementById('retakeBtn');

cameraBtn.addEventListener('click', async () => {
    // ALLOW CAMERA EVEN IF MODEL LOADING
    // if (!modelsLoaded) { alert("Tunggu loading model..."); return; } 
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.classList.remove('hidden');
        document.getElementById('playerPlaceholder').classList.add('hidden');
        cameraBtn.classList.add('hidden');
        captureBtn.classList.remove('hidden');
    } catch (err) {
        alert("Gagal akses kamera: " + err);
        console.error(err);
    }
});

captureBtn.addEventListener('click', async () => {
    if (!modelsLoaded) {
        alert("Sabar bro, AI-nya lagi loading... (Cek status di atas)");
        return;
    }
    // Capture content to canvas
    playerCanvas.width = video.videoWidth;
    playerCanvas.height = video.videoHeight;
    playerCtx.drawImage(video, 0, 0);

    // Stop stream
    stream.getTracks().forEach(track => track.stop());
    video.classList.add('hidden');
    playerCanvas.classList.remove('hidden');
    captureBtn.classList.add('hidden');
    retakeBtn.classList.remove('hidden');

    state.player.captured = true;

    // Detect Face
    detectFace('player', playerCanvas);
});

retakeBtn.addEventListener('click', () => {
    state.player.captured = false;
    state.player.landmarks = null;
    playerCanvas.classList.add('hidden');
    document.getElementById('playerPlaceholder').classList.remove('hidden');
    retakeBtn.classList.add('hidden');
    cameraBtn.classList.remove('hidden');
    cameraBtn.click(); // Re-open
});

// --- ENEMY UPLOAD LOGIC ---
const enemyUpload = document.getElementById('enemyUpload');
enemyUpload.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    if (!modelsLoaded) { alert("Tunggu model..."); return; }

    const file = e.target.files[0];
    const img = await faceapi.bufferToImage(file);

    enemyCanvas.width = img.width;
    enemyCanvas.height = img.height;
    enemyCtx.drawImage(img, 0, 0);

    enemyCanvas.classList.remove('hidden');
    document.getElementById('enemyPlaceholder').classList.add('hidden');

    state.enemy.loaded = true;
    detectFace('enemy', enemyCanvas);
});

// --- FACE DETECTION ---
async function detectFace(side, canvas) {
    const detections = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();

    if (!detections) {
        alert("Wajah tidak terdeteksi di sisi " + side.toUpperCase() + "! Coba foto lain.");
        if (side === 'player') retakeBtn.click();
        return;
    }

    const resized = faceapi.resizeResults(detections, { width: canvas.width, height: canvas.height });
    state[side].landmarks = resized.landmarks; // store full landmarks object
    console.log(`Landmarks for ${side} detected.`);

    checkReady();
}

function checkReady() {
    if (state.player.landmarks && state.enemy.landmarks) {
        const btn = document.getElementById('startBattleBtn');
        btn.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = "⚔️ MULAI SIKSAAN ⚔️";
    }
}

// --- BATTLE CONTROL ---
document.getElementById('startBattleBtn').addEventListener('click', () => {
    document.getElementById('startBattleBtn').classList.add('hidden');
    document.getElementById('suitPanel').classList.remove('hidden');
    document.getElementById('tortureDeck').classList.add('disabled');
    document.querySelector('.deck-status').textContent = "Menang Suit dulu!";
    alert("BATTLE START! Pilih Batu/Gunting/Kertas!");
});

// SUIT LOGIC
document.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', () => playSuit(btn.dataset.choice));
});

function playSuit(playerChoice) {
    const choices = ['batu', 'kertas', 'gunting'];
    const enemyChoice = choices[Math.floor(Math.random() * choices.length)];

    const resultDiv = document.getElementById('battleResult');
    const resultText = document.getElementById('resultText');
    const resultIcon = document.getElementById('resultIcon');

    resultDiv.classList.remove('hidden');

    // Logic
    // Draw
    if (playerChoice === enemyChoice) {
        resultIcon.textContent = "🤝";
        resultText.textContent = `SERI! Musuh pilih ${enemyChoice.toUpperCase()}.`;
        return;
    }

    // Player wins
    if (
        (playerChoice === 'batu' && enemyChoice === 'gunting') ||
        (playerChoice === 'kertas' && enemyChoice === 'batu') ||
        (playerChoice === 'gunting' && enemyChoice === 'kertas')
    ) {
        resultIcon.textContent = "🎉";
        resultText.textContent = `MENANG! Musuh pilih ${enemyChoice.toUpperCase()}.`;
        enableTorture(true); // Player turn to torture enemy
    } else {
        // Lose
        resultIcon.textContent = "💀";
        resultText.textContent = `KALAH! Musuh pilih ${enemyChoice.toUpperCase()}.`;
        enableTorture(false); // Enemy auto-tortures player
        setTimeout(() => autoTorturePlayer(), 1500);
    }
}

function enableTorture(isPlayerTurn) {
    const deck = document.getElementById('tortureDeck');
    const status = document.querySelector('.deck-status');

    if (isPlayerTurn) {
        deck.classList.remove('disabled');
        status.textContent = "SILAKAN SIKSA MUSUH!";
        window.activeTurn = 'player';
    } else {
        deck.classList.add('disabled');
        status.textContent = "Siap-siap disiksa...";
        window.activeTurn = 'enemy';
    }
}

// TORTURE CLICK HANDLER (Player attacks Enemy)
document.querySelectorAll('.t-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (window.activeTurn !== 'player') return;

        applyTorture('enemy', btn.dataset.type);

        // Reset turn
        document.getElementById('tortureDeck').classList.add('disabled');
        document.querySelector('.deck-status').textContent = "Gantian Suit lagi...";
        document.getElementById('battleResult').classList.add('hidden');

        // TODO: Check Win Condition
    });
});

function autoTorturePlayer() {
    const types = ['makeup', 'slap', 'poop', 'warp', 'punch']; // Add others
    const randomType = types[Math.floor(Math.random() * types.length)];

    applyTorture('player', randomType);

    // Reset
    document.getElementById('battleResult').classList.add('hidden');
}

// --- CORE TORTURE FUNCTION ---
function applyTorture(target, type) {
    const sideObj = state[target]; // player or enemy
    const canvas = target === 'player' ? playerCanvas : enemyCanvas;
    const ctx = target === 'player' ? playerCtx : enemyCtx;
    const landmarks = sideObj.landmarks;

    if (!landmarks) return;

    // Shake Effect on DOM
    const card = document.getElementById(target + 'Side');
    card.classList.remove('shake-hard');
    void card.offsetWidth;
    card.classList.add('shake-hard');

    // Reduce HP
    sideObj.hp -= 20;
    updateHP(target);

    // Apply Visual Logic
    const faceWidth = landmarks.getJawOutline()[16].x - landmarks.getJawOutline()[0].x;

    // Mapping random makeup effects if type is 'makeup'
    if (type === 'makeup') {
        const effects = ['lipstick_menor', 'lebam', 'panda', 'ingus', 'drool', 'pimple', 'blush_demam'];
        const effect = effects[Math.floor(Math.random() * effects.length)];
        applyMakeup(ctx, landmarks, effect, faceWidth);
    }
    else if (type === 'slap') {
        // 1. Trigger Animation
        triggerSlapAnimation(target);

        // 2. Draw Mark (Delayed slightly to match impact)
        setTimeout(() => {
            const cheek = landmarks.getJawOutline()[12];
            ctx.save();
            ctx.globalCompositeOperation = 'multiply';
            ctx.globalAlpha = 0.8;
            const size = faceWidth * 0.35;
            ctx.translate(cheek.x, cheek.y);
            ctx.rotate(-0.2);
            ctx.drawImage(assets.slapMark, -size / 2, -size / 2, size, size);
            ctx.restore();
        }, 800);
    }
    else if (type === 'poop') {
        const center = (pts) => {
            let x = 0, y = 0; pts.forEach(p => { x += p.x; y += p.y });
            return { x: x / pts.length, y: y / pts.length };
        };
        const forehead = center(landmarks.getLeftEye().concat(landmarks.getRightEye()));
        // Adjust forehead up
        const targetY = forehead.y - faceWidth * 0.3;

        const size = faceWidth * 0.4;

        ctx.save();
        ctx.translate(forehead.x, targetY);
        ctx.rotate((Math.random() - 0.5) * 0.5);
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 10;
        ctx.drawImage(assets.poop, -size / 2, -size / 2, size, size);
        ctx.restore();
    }
    else if (type === 'warp') {
        const warpEffects = ['big_eyes', 'small_eyes', 'big_mouth', 'twist_face', 'fat_cheeks'];
        const effect = warpEffects[Math.floor(Math.random() * warpEffects.length)];

        // Apply Warp (Requires complex pixel manip, using simplified version for stability)
        applyWarpEffect(ctx, canvas, landmarks, effect);
    }
    else if (type === 'punch') {
        // Visual: "BUGH!" Text
        const center = landmarks.getNose()[3];
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate((Math.random() - 0.5));
        ctx.font = `900 ${faceWidth * 0.4}px Impact`;
        ctx.fillStyle = '#D50000';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.fillText("BUGH!", 0, 0);
        ctx.strokeText("BUGH!", 0, 0);
        ctx.restore();

        // Effect: Add Bruise (Lebam)
        applyMakeup(ctx, landmarks, 'lebam', faceWidth);
    }

    sideObj.tortures++;
    checkGameOver();
}

// WARP LOGIC (Ported & Simplified)
function applyWarpEffect(ctx, canvas, landmarks, effect) {
    const getCenter = (pts) => {
        let x = 0, y = 0; pts.forEach(p => { x += p.x; y += p.y });
        return { x: x / pts.length, y: y / pts.length };
    };

    // Map points
    const leftEye = getCenter(landmarks.getLeftEye());
    const rightEye = getCenter(landmarks.getRightEye());
    const mouth = getCenter(landmarks.getMouth());
    const nose = getCenter(landmarks.getNose());
    const jaw = landmarks.getJawOutline();

    // Face Width reference
    const faceWidth = Math.abs(jaw[16].x - jaw[0].x);
    const refSize = faceWidth * 0.25;

    // Helper for warp
    const warpPixels = (cx, cy, radius, strength, mode) => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;
        const h = canvas.height;
        const radiusSq = radius * radius;

        // Copy source
        const sourceBuffer = new Uint8ClampedArray(data);

        const xMin = Math.max(0, Math.floor(cx - radius));
        const xMax = Math.min(w, Math.ceil(cx + radius));
        const yMin = Math.max(0, Math.floor(cy - radius));
        const yMax = Math.min(h, Math.ceil(cy + radius));

        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const distSq = dx * dx + dy * dy;

                if (distSq < radiusSq) {
                    const dist = Math.sqrt(distSq);
                    let sourceX = x, sourceY = y;
                    const factor = (radius - dist) / radius; // 0 at edge, 1 at center

                    if (mode === 'magnify') {
                        // Pull from closer to center
                        const amount = factor * strength * radius * 0.5;
                        const angle = Math.atan2(dy, dx);
                        sourceX = x - Math.cos(angle) * amount;
                        sourceY = y - Math.sin(angle) * amount;
                    } else if (mode === 'pinch') {
                        // Pull from further away
                        const amount = factor * strength * radius * 0.5;
                        const angle = Math.atan2(dy, dx);
                        sourceX = x + Math.cos(angle) * amount;
                        sourceY = y + Math.sin(angle) * amount;
                    } else if (mode === 'twist') {
                        const angleOffset = factor * strength * 2.0;
                        const angle = Math.atan2(dy, dx) + angleOffset;
                        sourceX = cx + Math.cos(angle) * dist;
                        sourceY = cy + Math.sin(angle) * dist;
                    }

                    // Bilinear Interpolation
                    const x0 = Math.floor(sourceX);
                    const x1 = Math.min(w - 1, x0 + 1);
                    const y0 = Math.floor(sourceY);
                    const y1 = Math.min(h - 1, y0 + 1);

                    const wx = sourceX - x0;
                    const wy = sourceY - y0;

                    const idxDest = (y * w + x) * 4;
                    const idx00 = (y0 * w + x0) * 4; // Top-Left
                    const idx10 = (y0 * w + x1) * 4; // Top-Right
                    const idx01 = (y1 * w + x0) * 4; // Btm-Left
                    const idx11 = (y1 * w + x1) * 4; // Btm-Right

                    for (let c = 0; c < 4; c++) { // RGBA
                        const v00 = sourceBuffer[idx00 + c];
                        const v10 = sourceBuffer[idx10 + c];
                        const v01 = sourceBuffer[idx01 + c];
                        const v11 = sourceBuffer[idx11 + c];

                        const top = v00 * (1 - wx) + v10 * wx;
                        const btm = v01 * (1 - wx) + v11 * wx;
                        data[idxDest + c] = top * (1 - wy) + btm * wy;
                    }
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

    // Apply specific effect
    ctx.save();
    try {
        switch (effect) {
            case 'big_eyes':
                warpPixels(leftEye.x, leftEye.y, refSize * 1.5, 0.6, 'magnify');
                warpPixels(rightEye.x, rightEye.y, refSize * 1.5, 0.6, 'magnify');
                break;
            case 'small_eyes':
                warpPixels(leftEye.x, leftEye.y, refSize * 1.5, 0.8, 'pinch');
                warpPixels(rightEye.x, rightEye.y, refSize * 1.5, 0.8, 'pinch');
                break;
            case 'big_mouth':
                warpPixels(mouth.x, mouth.y, refSize * 1.8, 0.7, 'magnify');
                break;
            case 'twist_face':
                const noseC = landmarks.getNose()[3];
                warpPixels(noseC.x, noseC.y, faceWidth * 0.7, 1.0, 'twist');
                break;
            case 'fat_cheeks':
                const lCheek = jaw[3];
                const rCheek = jaw[13];
                warpPixels(lCheek.x, lCheek.y, refSize * 2, 0.5, 'magnify');
                warpPixels(rCheek.x, rCheek.y, refSize * 2, 0.5, 'magnify');
                break;
        }
    } catch (e) {
        console.error("Warp failed:", e);
    }
    ctx.restore();
}

// SLAP ANIMATION
function triggerSlapAnimation(target) {
    const overlay = document.getElementById(target + 'Overlay');

    // Create Elements
    const hand = document.createElement('img');
    hand.src = assets.slapHand;
    hand.className = 'slap-hand animate-slap';
    hand.style.setProperty('--tx', '50%'); // Center of overlay
    hand.style.setProperty('--ty', '50%');
    hand.style.left = '0';
    hand.style.top = '0';

    const impact = document.createElement('img');
    impact.src = assets.slapImpact;
    impact.className = 'slap-impact hidden';
    impact.style.left = '50%';
    impact.style.top = '50%';

    overlay.appendChild(hand);
    overlay.appendChild(impact);

    // Impact Timing
    setTimeout(() => {
        impact.classList.remove('hidden');
        impact.classList.add('animate-impact');
    }, 800);

    // Cleanup
    setTimeout(() => {
        hand.remove();
        impact.remove();
    }, 2000);
}

// MAKEUP LOGIC (Restored Full Suite)
function applyMakeup(ctx, l, effect, faceWidth) {
    const nose = l.getNose();
    const mouth = l.getMouth();
    const leftEye = l.getLeftEye();
    const rightEye = l.getRightEye();
    const jaw = l.getJawOutline();

    const center = (pts) => {
        let x = 0, y = 0; pts.forEach(p => { x += p.x; y += p.y });
        return { x: x / pts.length, y: y / pts.length };
    };

    switch (effect) {
        case 'pimple':
            let target = nose[Math.random() > 0.5 ? 0 : 4]; // Bridge side
            let pSize = faceWidth * 0.45;
            ctx.drawImage(assets.pimple, target.x - pSize / 2, target.y, pSize, pSize);
            break;
        case 'drool':
            let lip = mouth[14];
            let dSize = faceWidth * 0.25;
            ctx.filter = 'hue-rotate(140deg) brightness(1.2) saturate(0.8)';
            ctx.drawImage(assets.drool, lip.x - dSize / 2, lip.y - dSize * 0.15, dSize, dSize * 2.5);
            ctx.filter = 'none';
            break;
        case 'ingus':
            let nostril = nose[6]; // Right nostril usually
            let sSize = faceWidth * 0.4;
            ctx.drawImage(assets.snot, nostril.x - sSize / 2, nostril.y - sSize * 0.6, sSize, sSize * 1.5);
            break;
        case 'lebam':
            let eye = center(leftEye);
            const grad = ctx.createRadialGradient(eye.x, eye.y, 10, eye.x, eye.y, faceWidth * 0.15);
            grad.addColorStop(0, '#311B92');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(eye.x, eye.y, faceWidth * 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            break;
        case 'mata_panda':
            let cL = center(leftEye);
            let cR = center(rightEye);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = 0.6;
            ctx.filter = `blur(${faceWidth * 0.04}px)`;
            ctx.beginPath();
            ctx.ellipse(cL.x, cL.y + faceWidth * 0.02, faceWidth * 0.14, faceWidth * 0.11, 0, 0, Math.PI * 2);
            ctx.ellipse(cR.x, cR.y + faceWidth * 0.02, faceWidth * 0.14, faceWidth * 0.11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            break;
        case 'lipstick_menor':
            ctx.fillStyle = '#B71C1C';
            ctx.globalCompositeOperation = 'multiply';
            ctx.beginPath();
            // Simple mouth hull
            ctx.moveTo(mouth[0].x, mouth[0].y);
            for (let i = 1; i < 7; i++) ctx.lineTo(mouth[i].x, mouth[i].y); // Upper outer
            for (let i = 12; i > 6; i--) ctx.lineTo(mouth[i].x, mouth[i].y); // Lower outer
            ctx.closePath();
            ctx.fill();

            // Overline stroke
            ctx.strokeStyle = '#B71C1C';
            ctx.lineWidth = faceWidth * 0.03;
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
        case 'blush_demam':
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = '#D50000';
            ctx.globalAlpha = 0.5;
            ctx.filter = `blur(${faceWidth * 0.06}px)`;
            const cLeft = jaw[2];
            const cRight = jaw[14];
            ctx.beginPath();
            ctx.arc(cLeft.x + faceWidth * 0.1, cLeft.y - faceWidth * 0.05, faceWidth * 0.12, 0, Math.PI * 2);
            ctx.arc(cRight.x - faceWidth * 0.1, cRight.y - faceWidth * 0.05, faceWidth * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            break;
    }
}

function updateHP(target) {
    const bar = document.getElementById(target + 'HPBar');
    const text = document.getElementById(target + 'HPText');
    const hp = state[target].hp;

    bar.style.width = hp + '%';
    text.textContent = hp + '%';

    if (hp <= 50) bar.classList.add('damaged');
    if (hp <= 20) bar.classList.add('critical');
}

function checkGameOver() {
    if (state.player.hp <= 0) alert("GAME OVER! YOU LOSE! MUKA LU HANCUR!");
    if (state.enemy.hp <= 0) alert("WINNER! TEMAN LU TEWAS! 🤣");
}

// Start
init();
