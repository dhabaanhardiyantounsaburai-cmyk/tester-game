document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const canvas = document.getElementById('prankCanvas');
    const ctx = canvas.getContext('2d');
    const controls = document.getElementById('controls');
    const canvasContainer = document.getElementById('canvas-container');
    const tortureBtn = document.getElementById('tortureBtn');
    const flourBtn = document.getElementById('flourBtn');
    const tortureCountSpan = document.getElementById('torture-count');
    const resetBtn = document.getElementById('resetBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');

    let currentStepMarker = 0;
    let currentStepFlour = 0;
    let currentStepEgg = 0;

    let currentStepSlap = 0;
    let currentStepPoop = 0;
    let currentStepStamp = 0; // New state
    const maxSteps = 5;
    let baseImage = new Image();
    let faceLandmarks = null;
    let modelsLoaded = false;
    let placedEggs = [];

    let placedSlaps = [];
    let placedPoops = [];
    let placedStamps = []; // Store stamp positions
    let markerSequence = [];

    // Preload Slap Assets
    const slapMarkImg = new Image();
    slapMarkImg.src = 'mark_handprint_final.png'; // FINAL version (White BG)
    const slapHandImg = new Image(); // For sizing ref if needed
    slapHandImg.src = 'hand_slap.png'; // Store random order of marker steps

    // Crop state
    let cropState = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        scale: 1,
        rotation: 0
    };

    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights/';

    async function loadModels() {
        try {
            loadingDiv.classList.remove('hidden');
            await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
            await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
            await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL); // Load Gender Model
            modelsLoaded = true;
            console.log("Models loaded");
        } catch (error) {
            console.error("Error loading models:", error);
            alert("Gagal memuat model deteksi wajah. Cek koneksi internet.");
        } finally {
            loadingDiv.classList.add('hidden');
        }
    }

    loadModels();

    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                baseImage = new Image();
                baseImage.onload = async () => {
                    await initGame();
                };
                baseImage.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    async function initGame() {
        if (!modelsLoaded) {
            await loadModels();
        }

        canvasContainer.classList.remove('hidden');
        loadingDiv.classList.remove('hidden');

        // Reset state
        faceLandmarks = null;
        currentStepMarker = 0;
        currentStepFlour = 0;
        currentStepEgg = 0;
        currentStepSlap = 0;
        currentStepPoop = 0;
        currentStepStamp = 0;
        placedEggs = [];
        placedSlaps = [];
        placedPoops = [];
        placedStamps = [];

        // Clear flies
        const flyContainer = document.getElementById('flyContainer');
        if (flyContainer) flyContainer.innerHTML = '';

        // Randomize Marker Sequence (Fisher-Yates Shuffle)
        markerSequence = [1, 2, 3, 4, 5];
        for (let i = markerSequence.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            // Swap using temp variable for maximum compatibility
            const temp = markerSequence[i];
            markerSequence[i] = markerSequence[j];
            markerSequence[j] = temp;
        }
        console.log("NEW Marker sequence generated:", markerSequence);

        try {
            const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.4 });
            // Enable Gender Detection
            const detection = await faceapi.detectSingleFace(baseImage, detectorOptions).withFaceLandmarks().withAgeAndGender();

            if (detection) {
                faceLandmarks = detection.landmarks;
                messageDiv.textContent = "Wajah terdeteksi! Auto-crop aktif.";
                messageDiv.style.color = "#00ffcc";

                // Calculate Crop Region
                const box = detection.detection.box;
                const padding = Math.max(box.width, box.height) * 0.6;

                let cx = box.x - padding;
                let cy = box.y - padding * 1.2;
                let cw = box.width + padding * 2;
                let ch = box.height + padding * 2.2;

                if (cx < 0) cx = 0;
                if (cy < 0) cy = 0;
                if (cx + cw > baseImage.width) cw = baseImage.width - cx;
                if (cy + ch > baseImage.height) ch = baseImage.height - cy;

                cropState = {
                    x: cx,
                    y: cy,
                    width: cw,
                    height: ch,
                    rotation: 0
                };

                // Rotation calculation
                const leftEye = faceLandmarks.getLeftEye();
                const rightEye = faceLandmarks.getRightEye();
                const leftEyeCenter = getCenter(leftEye);
                const rightEyeCenter = getCenter(rightEye);
                const dx = rightEyeCenter.x - leftEyeCenter.x;
                const dy = rightEyeCenter.y - leftEyeCenter.y;
                cropState.rotation = Math.atan2(dy, dx);

            } else {
                loadingDiv.classList.add('hidden');
                alert("Wajah tidak terdeteksi! Mohon upload foto wajah yang jelas ya bro.");
                canvasContainer.classList.add('hidden');
                document.getElementById('upload-section').classList.remove('hidden');
                imageUpload.value = '';
                return;
            }
        } catch (err) {
            console.error(err);
            loadingDiv.classList.add('hidden');
            alert("Terjadi kesalahan saat mendeteksi wajah.");
            return;
        }

        canvas.width = cropState.width;
        canvas.height = cropState.height;

        drawBaseImage();

        loadingDiv.classList.add('hidden');
        controls.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        document.getElementById('upload-section').classList.add('hidden');

        updateUI();
    }

    function drawBaseImage() {
        ctx.drawImage(
            baseImage,
            cropState.x, cropState.y, cropState.width, cropState.height,
            0, 0, canvas.width, canvas.height
        );
    }

    function getCenter(points) {
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { x, y };
    }

    function mapPoint(point) {
        return {
            x: point.x - cropState.x,
            y: point.y - cropState.y
        };
    }

    function updateUI() {
        const total = currentStepMarker + currentStepFlour + currentStepEgg + currentStepSlap + currentStepPoop + currentStepStamp;
        tortureCountSpan.textContent = total;

        tortureBtn.disabled = currentStepMarker >= maxSteps;
        flourBtn.disabled = currentStepFlour >= maxSteps;
        document.getElementById('eggBtn').disabled = currentStepEgg >= maxSteps;

        tortureBtn.textContent = currentStepMarker >= maxSteps ? "CORETAN PENUH!" : "🖊️ CORET WAJAH!";

        flourBtn.textContent = currentStepFlour >= maxSteps ? "PENUH TEPUNG!" : "☁️ LEMPAR TEPUNG!";
        document.getElementById('eggBtn').textContent = currentStepEgg >= maxSteps ? "PENUH TELUR!" : "🥚 LEMPAR TELUR!";

        const poopBtn = document.getElementById('poopBtn');
        if (poopBtn) {
            poopBtn.disabled = currentStepPoop >= maxSteps;
            poopBtn.textContent = currentStepPoop >= maxSteps ? "PENUH TAHI!" : "💩 LEMPAR KOTORAN!";
        }

        const slapBtn = document.getElementById('slapBtn');
        slapBtn.disabled = currentStepSlap >= maxSteps;
        slapBtn.disabled = currentStepSlap >= maxSteps;
        slapBtn.textContent = currentStepSlap >= maxSteps ? "PIPI MERAH!" : "🤚 TAMPAR WAJAH!";

        const stampBtn = document.getElementById('stampBtn');
        if (stampBtn) {
            stampBtn.disabled = currentStepStamp >= 3; // Max 3 stamps (big size)
            stampBtn.textContent = currentStepStamp >= 3 ? "PENUH CAP!" : "🛑 STEMPEL JIDAT!";
        }
    }

    tortureBtn.addEventListener('click', () => {
        if (currentStepMarker >= maxSteps) return;

        // Ensure sequence exists
        if (!markerSequence || markerSequence.length === 0) {
            console.warn("Marker sequence missing, re-initializing...");
            markerSequence = [1, 2, 3, 4, 5]; // Fallback
        }

        // Use random step from the shuffled sequence
        const stepToApply = markerSequence[currentStepMarker];
        console.log(`Step ${currentStepMarker + 1}: Applying marker type ${stepToApply}`);

        currentStepMarker++;
        applyTorture(stepToApply);
        updateUI();
    });

    flourBtn.addEventListener('click', () => {
        if (currentStepFlour >= maxSteps) return;
        currentStepFlour++;
        applyFlour(currentStepFlour);
        updateUI();
    });

    document.getElementById('eggBtn').addEventListener('click', () => {
        if (currentStepEgg >= maxSteps) return;
        currentStepEgg++;
        applyEgg();
        updateUI();
    });

    const poopBtn = document.getElementById('poopBtn');
    if (poopBtn) {
        poopBtn.addEventListener('click', () => {
            if (currentStepPoop >= maxSteps) return;

            // 1. Calculate Target
            const targetData = calculatePoopTarget();
            if (!targetData) {
                alert("Gak nemu tempat buat kotoran bro. Penuh!");
                return;
            }

            // 2. Apply Poop (Instant)
            currentStepPoop++;
            applyPoop(targetData);

            // 3. Spawn Flies (Delayed slightly)
            setTimeout(() => {
                spawnFlies(targetData);
            }, 500);

            updateUI();
        });
    }

    const stampBtn = document.getElementById('stampBtn');
    if (stampBtn) {
        stampBtn.addEventListener('click', () => {
            // Limit to 3 stamps
            if (currentStepStamp >= 3) return;

            // 1. Determine "Aib" based on Gender
            let stamps = ['stamp_ditolak.png', 'stamp_buronan.png', 'stamp_hutang.png'];

            // Smart Logic: Gender based
            if (faceLandmarks && faceLandmarks.gender) {
                const gender = faceLandmarks.gender;
                // Add logic if we had specific gender stamps, for now Jomblo matches all
            }
            stamps.push('stamp_jomblo.png');

            const randomStamp = stamps[Math.floor(Math.random() * stamps.length)];

            // 2. Calculate Target
            const targetData = calculateStampTarget();

            if (!targetData) {
                alert("Jidatnya udah penuh aib bro!");
                return;
            }

            // 3. Apple Stamp
            currentStepStamp++;
            applyStamp(targetData, randomStamp);
            updateUI();
        });
    }

    document.getElementById('slapBtn').addEventListener('click', () => {
        if (currentStepSlap >= maxSteps) return;

        // 1. Calculate Target FIRST
        const targetData = calculateSlapTarget();
        if (!targetData) {
            alert("Gak nemu tempat buat nampar bro. Penuh!");
            return;
        }

        // 2. Setup Animation
        const overlay = document.getElementById('slapOverlay');
        const hand = document.getElementById('slapHand');
        const impact = document.getElementById('slapImpact');
        const canvas = document.getElementById('prankCanvas');
        const container = document.getElementById('canvas-container');

        // Coordinate Mapping (Internal Canvas -> Visual Overlay)
        // 1. Get Visual Dimensions
        const rect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // 2. Calculate Scale Factors
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;

        // 3. Calculate Offsets (if canvas is centered/letterboxed)
        const offsetX = rect.left - containerRect.left;
        const offsetY = rect.top - containerRect.top;

        // 4. Map Target Data to Visual Coordinates
        const visualX = (targetData.x * scaleX) + offsetX;
        const visualY = (targetData.y * scaleY) + offsetY;

        // Hand image is 300px width. Center is 150px.
        // We set CSS variables for the Keyframes using VISUAL coords
        const handCenterOffset = 150;

        hand.style.setProperty('--tx', `${visualX - handCenterOffset}px`);
        hand.style.setProperty('--ty', `${visualY - handCenterOffset}px`);

        // Position Impact Exact Center (Visual)
        if (impact) {
            impact.style.left = `${visualX}px`;
            impact.style.top = `${visualY}px`;
        }

        overlay.classList.remove('hidden');

        // Reset Animations
        hand.classList.remove('animate-slap');
        if (impact) {
            impact.classList.add('hidden');
            impact.classList.remove('animate-impact');
        }

        void hand.offsetWidth; // Trigger reflow
        hand.classList.add('animate-slap');

        // 3. Schedule Events
        const IMPACT_TIME = 800; // Hand hits face (800ms)

        // A. Show Explosion (Ledakan) & Shake Screen
        setTimeout(() => {
            // Show Impact
            if (impact) {
                impact.classList.remove('hidden');
                impact.classList.add('animate-impact');
            }

            // Trigger Shake
            container.classList.add('shake-hard');
            setTimeout(() => {
                container.classList.remove('shake-hard');
            }, 500);

        }, IMPACT_TIME);

        // B. Wait 1 Second, then Show Mark & Hide Explosion
        setTimeout(() => {
            if (impact) impact.classList.add('hidden'); // Hide explosion

            // Show Mark
            currentStepSlap++;
            applySlap(targetData); // Draw on canvas
            updateUI();
        }, IMPACT_TIME + 1000); // 1800ms total

        // C. Cleanup Overlay
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 2500); // Give enough time for impact fade out
    });

    resetBtn.addEventListener('click', () => {
        document.getElementById('upload-section').classList.remove('hidden');
        canvasContainer.classList.add('hidden');
        controls.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        imageUpload.value = '';
        faceLandmarks = null;
    });

    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'wajah-siksaan.png';
        link.href = canvas.toDataURL();
        link.click();
    });

    function applyFlour(step) {
        if (!faceLandmarks) return;

        ctx.save();

        // 1. Create Face Clipping Mask
        const jaw = faceLandmarks.getJawOutline();
        const leftBrow = faceLandmarks.getLeftEyeBrow();
        const rightBrow = faceLandmarks.getRightEyeBrow();

        ctx.beginPath();
        const start = mapPoint(jaw[0]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < jaw.length; i++) {
            const p = mapPoint(jaw[i]);
            ctx.lineTo(p.x, p.y);
        }
        // Top cap approximation
        const foreheadTop = {
            x: (start.x + mapPoint(jaw[16]).x) / 2,
            y: Math.min(mapPoint(leftBrow[2]).y, mapPoint(rightBrow[2]).y) - (canvas.height * 0.15)
        };
        ctx.quadraticCurveTo(mapPoint(jaw[16]).x, mapPoint(rightBrow[4]).y, foreheadTop.x * 1.5, foreheadTop.y);
        ctx.lineTo(foreheadTop.x, foreheadTop.y);
        ctx.lineTo(start.x, mapPoint(leftBrow[0]).y - 20);

        ctx.closePath();
        ctx.clip();

        // 2. Chalk Stroke Function (Textured Rect)
        const drawChalkStroke = (x, y, width, height, angle) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            const area = width * height;
            const density = 0.8; // Increased density for finer particles
            // User requested "10x thicker" previously, now "smaller size/natural"
            // We increase count but decrease individual particle size
            const count = area * density * 1.5;

            ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';

            for (let i = 0; i < count; i++) {
                // Random position within rectangle centered at 0,0
                const px = (Math.random() - 0.5) * width;
                const py = (Math.random() - 0.5) * height;

                // Texture: Concentration in middle, fading edges
                const distX = Math.abs(px) / (width / 2);
                const distY = Math.abs(py) / (height / 2);

                if (Math.random() > (distX * distX * distX) && Math.random() > (distY * distY)) {
                    // Draw tiny irregular rect/dot - SMALLER now for "natural" look
                    const w = 0.5 + Math.random() * 1.5; // Was 1 + rand*2
                    const h = 0.5 + Math.random() * 1.5; // Was 1 + rand*2

                    // Slightly lower alpha for more layering/powdery feel
                    ctx.globalAlpha = 0.4 + Math.random() * 0.4; // Was 0.6 + rand*0.4
                    ctx.fillRect(px, py, w, h);
                }
            }
            ctx.restore();
        };

        const w = canvas.width;
        const h = canvas.height;
        try {
            // Defined Safe Zones (Relative to landmarks)
            // We pick one random zone each time to ensure visibility and safety
            // Verify landmarks exist
            if (!faceLandmarks || !faceLandmarks.positions) {
                console.error("Missing landmarks");
                alert("Error: Wajah kehilangan jejak (Landmarks missing).");
                return;
            }

            const zones = [
                { id: 'forehead', base: mapPoint(faceLandmarks.positions[27]), offset: { x: 0, y: -h * 0.08 }, scale: { w: 0.35, h: 0.1 } },
                { id: 'cheekL', base: mapPoint(faceLandmarks.positions[2]), offset: { x: w * 0.05, y: 0 }, scale: { w: 0.18, h: 0.08 } },
                { id: 'cheekR', base: mapPoint(faceLandmarks.positions[14]), offset: { x: -w * 0.05, y: 0 }, scale: { w: 0.18, h: 0.08 } },
                { id: 'chin', base: mapPoint(faceLandmarks.positions[8]), offset: { x: 0, y: -h * 0.05 }, scale: { w: 0.15, h: 0.06 } },
                { id: 'noseHigh', base: mapPoint(faceLandmarks.getNose()[0]), offset: { x: 0, y: h * 0.02 }, scale: { w: 0.06, h: 0.08 } },
                { id: 'jawL', base: mapPoint(faceLandmarks.positions[4]), offset: { x: 0, y: -h * 0.02 }, scale: { w: 0.1, h: 0.1 } },
                { id: 'jawR', base: mapPoint(faceLandmarks.positions[12]), offset: { x: 0, y: -h * 0.02 }, scale: { w: 0.1, h: 0.1 } }
            ];

            // Pick a random zone
            const zone = zones[Math.floor(Math.random() * zones.length)];
            console.log("Selected zone:", zone.id);

            // Add random jitter to the position within the zone
            const jitterX = (Math.random() - 0.5) * (w * 0.05);
            const jitterY = (Math.random() - 0.5) * (h * 0.03);

            // Randomize size slightly
            const finalW = w * (zone.scale.w * (0.8 + Math.random() * 0.4));
            const finalH = h * (zone.scale.h * (0.8 + Math.random() * 0.4));

            // Randomize rotation slightly
            const randomRot = (Math.random() - 0.5) * 0.3;

            drawChalkStroke(
                zone.base.x + zone.offset.x + jitterX,
                zone.base.y + zone.offset.y + jitterY,
                finalW,
                finalH,
                cropState.rotation + randomRot
            );
        } catch (e) {
            console.error("Error in applyFlour:", e);
            alert("Error in flour effect: " + e.message);
        }

        ctx.restore();
    }

    function applyEgg() {
        console.log("Applying egg...");
        if (!faceLandmarks) {
            alert("Wajah belum terdeteksi sempurna bun!");
            return;
        }

        const w = canvas.width;
        const h = canvas.height;
        const rot = cropState.rotation;

        ctx.save();

        try {
            // 1. Create Face Clipping Mask (Strict containment)
            const jaw = faceLandmarks.getJawOutline();
            const leftBrow = faceLandmarks.getLeftEyeBrow();
            const rightBrow = faceLandmarks.getRightEyeBrow();

            ctx.beginPath();
            const start = mapPoint(jaw[0]);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < jaw.length; i++) {
                const p = mapPoint(jaw[i]);
                ctx.lineTo(p.x, p.y);
            }
            // Top cap approximation
            const foreheadTop = {
                x: (start.x + mapPoint(jaw[16]).x) / 2,
                y: Math.min(mapPoint(leftBrow[2]).y, mapPoint(rightBrow[2]).y) - (canvas.height * 0.15)
            };
            ctx.quadraticCurveTo(mapPoint(jaw[16]).x, mapPoint(rightBrow[4]).y, foreheadTop.x * 1.5, foreheadTop.y);
            ctx.lineTo(foreheadTop.x, foreheadTop.y);
            ctx.lineTo(start.x, mapPoint(leftBrow[0]).y - 20);

            ctx.closePath();
            ctx.clip(); // <--- CLIP EVERYTHING TO FACE

            // Avoid central face (eyes, nose, mouth) to keep identity visible
            // But bring closer to center as requested (Move inwards from edges)
            const zones = [
                // Forehead (Center-ish)
                { id: 'forehead', base: mapPoint(faceLandmarks.positions[27]), offset: { x: 0, y: -h * 0.08 }, scale: 0.9 }, // Lowered from 0.12
                // Cheeks (Moved Inward)
                { id: 'cheekL_mid', base: mapPoint(faceLandmarks.positions[2]), offset: { x: w * 0.05, y: -h * 0.02 }, scale: 0.8 }, // Base changed to 2, moved right (in)
                { id: 'cheekR_mid', base: mapPoint(faceLandmarks.positions[14]), offset: { x: -w * 0.05, y: -h * 0.02 }, scale: 0.8 }, // Base changed to 14, moved left (in)
                // Chin/Jaw (Moved Up/In)
                { id: 'chin', base: mapPoint(faceLandmarks.positions[8]), offset: { x: 0, y: 0 }, scale: 0.75 }, // Removed downward offset
                { id: 'jawL_in', base: mapPoint(faceLandmarks.positions[5]), offset: { x: w * 0.02, y: -h * 0.02 }, scale: 0.7 }, // Base 5, moved in
                { id: 'jawR_in', base: mapPoint(faceLandmarks.positions[11]), offset: { x: -w * 0.02, y: -h * 0.02 }, scale: 0.7 }  // Base 11, moved in
            ];

            // Try to find a non-overlapping spot
            let bestZone = null;
            let bestTx = 0, bestTy = 0, bestSize = 0;
            let foundSpot = false;

            for (let attempt = 0; attempt < 10; attempt++) {
                const zone = zones[Math.floor(Math.random() * zones.length)];
                const jitterX = (Math.random() - 0.5) * (w * 0.05);
                const jitterY = (Math.random() - 0.5) * (h * 0.03);

                const tx = zone.base.x + zone.offset.x + jitterX;
                const ty = zone.base.y + zone.offset.y + jitterY;
                const size = (w * 0.05 + Math.random() * w * 0.02) * zone.scale;

                // Check collision
                let overlap = false;
                for (const egg of placedEggs) {
                    const dx = tx - egg.x;
                    const dy = ty - egg.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < (size + egg.size) * 0.8) { // Allow slight overlap (20%)
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    bestZone = zone;
                    bestTx = tx;
                    bestTy = ty;
                    bestSize = size;
                    foundSpot = true;
                    break;
                }
            }

            if (!foundSpot) {
                console.warn("Could not find non-overlapping spot, skipping egg.");
                return; // Skip drawing this egg
            }

            // Save position
            placedEggs.push({ x: bestTx, y: bestTy, size: bestSize });

            drawRotated(bestTx, bestTy, rot, () => {
                // 1. Egg White (Albumin) - RAW & CLEAR SLIME
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Visible but transparent (User requested "more white")
                ctx.beginPath();
                ctx.moveTo(0, -bestSize);

                // Irregular splat shape
                for (let i = 0; i <= 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const noise = Math.random() * 0.3;
                    const r = bestSize * (0.8 + noise);
                    const x = Math.cos(angle) * r;
                    const y = Math.sin(angle) * r;
                    ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();

                // Stronger Rim/Shadow to define the clear shape
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // White rim for light reflection at edge
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; // Subtle dark shadow for depth
                ctx.lineWidth = 1;
                ctx.stroke();

                // Albumin Drip
                ctx.beginPath();
                const dripW = bestSize * (0.3 + Math.random() * 0.2);
                const dripH = bestSize * (1.2 + Math.random() * 0.8);
                const dripOffset = (Math.random() - 0.5) * bestSize * 0.5;
                ctx.moveTo(dripOffset - dripW / 2, bestSize / 2);
                ctx.bezierCurveTo(dripOffset - dripW, bestSize + dripH, dripOffset + dripW, bestSize + dripH, dripOffset + dripW / 2, bestSize / 2);
                ctx.fill();

                // 2. Yolk (Vitelline) - BROKEN & DRIPPING
                ctx.fillStyle = '#ffb300';
                ctx.beginPath();

                // Base broken yolk (flattened)
                const yolkW = bestSize * 0.35;
                const yolkH = bestSize * 0.25;
                const yolkY = bestSize * 0.1;

                ctx.moveTo(-yolkW, yolkY);
                ctx.bezierCurveTo(-yolkW, yolkY - yolkH, yolkW, yolkY - yolkH, yolkW, yolkY);
                // Leleh ke bawah (Dripping yolk)
                ctx.bezierCurveTo(yolkW, yolkY + yolkH, yolkW * 0.5, yolkY + yolkH * 2.5, 0, yolkY + yolkH * 3.5); // Long drip
                ctx.bezierCurveTo(-yolkW * 0.5, yolkY + yolkH * 2.5, -yolkW, yolkY + yolkH, -yolkW, yolkY);

                ctx.fill();

                // Yolk Highlight (Glossy Reflection)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.ellipse(-bestSize * 0.1, bestSize * 0.05, bestSize * 0.08, bestSize * 0.04, -Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();

                // White Highlight (Wet look on the albumin, scattered)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(bestSize * 0.3, -bestSize * 0.2, bestSize * 0.05, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(-bestSize * 0.2, -bestSize * 0.3, bestSize * 0.03, 0, Math.PI * 2);
                ctx.fill();
            });

        } catch (e) {
            console.error("Error drawing egg:", e);
            alert("Gagal melempar telur: " + e.message);
        }

        ctx.restore();
    }

    function applyTorture(step) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'multiply';

        const useLandmarks = !!faceLandmarks;
        const fb = {
            eyeL: { x: w * 0.35, y: h * 0.45, r: w * 0.1 },
            forehead: { y: h * 0.25, x1: w * 0.3, x2: w * 0.7 },
            nose: { x: w * 0.5, y: h * 0.55 },
            chin: { x: w * 0.55, y: h * 0.8 }
        };

        switch (step) {
            case 1: // Mata Kiri
                setupMarker('black', 4);
                if (useLandmarks) {
                    const leftEyePoints = faceLandmarks.getLeftEye();
                    const center = mapPoint(getCenter(leftEyePoints));
                    const minX = Math.min(...leftEyePoints.map(p => p.x)) - cropState.x;
                    const maxX = Math.max(...leftEyePoints.map(p => p.x)) - cropState.x;
                    const width = (maxX - minX) * 1.8;
                    const height = width * 1.0;

                    drawRotated(center.x, center.y, cropState.rotation, () => {
                        for (let i = 0; i < 3; i++) {
                            ctx.beginPath();
                            ctx.ellipse(
                                0 + (Math.random() - 0.5) * 5,
                                0 + (Math.random() - 0.5) * 5,
                                width / 2, height / 2,
                                0, 0, Math.PI * 2
                            );
                            ctx.stroke();
                        }
                    });
                } else {
                    ctx.beginPath();
                    ctx.arc(fb.eyeL.x, fb.eyeL.y, fb.eyeL.r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;

            case 2: // Jidat Stitches
                setupMarker('#111', 3);
                if (useLandmarks) {
                    const leftBrow = faceLandmarks.getLeftEyeBrow();
                    const rightBrow = faceLandmarks.getRightEyeBrow();
                    const p1 = mapPoint(leftBrow[0]);
                    const p2 = mapPoint(rightBrow[4]);
                    const mx = (p1.x + p2.x) / 2;
                    const my = (p1.y + p2.y) / 2;
                    const noseTop = mapPoint(faceLandmarks.getNose()[0]);
                    const dist = Math.sqrt(Math.pow(mx - noseTop.x, 2) + Math.pow(my - noseTop.y, 2));
                    const cx = mx;
                    const cy = my - dist * 1.5;

                    drawRotated(cx, cy, cropState.rotation, () => {
                        const len = dist * 3;
                        ctx.beginPath();
                        ctx.moveTo(-len / 2, 0);
                        ctx.bezierCurveTo(-len / 4, -5, len / 4, 5, len / 2, 0);
                        ctx.stroke();
                        for (let x = -len / 2 + 10; x < len / 2; x += 15) {
                            ctx.beginPath();
                            ctx.moveTo(x, -10 + Math.random() * 4);
                            ctx.lineTo(x, 10 + Math.random() * 4);
                            ctx.stroke();
                        }
                    });
                } else {
                    ctx.beginPath();
                    ctx.moveTo(fb.forehead.x1, fb.forehead.y);
                    ctx.lineTo(fb.forehead.x2, fb.forehead.y);
                    ctx.stroke();
                }
                break;

            case 3: // Bulu Hidung
                setupMarker('black', 2);
                if (useLandmarks) {
                    const nose = faceLandmarks.getNose();
                    const nL = mapPoint(nose[4]);
                    const nR = mapPoint(nose[8]);
                    [nL, nR].forEach(p => {
                        for (let i = 0; i < 5; i++) {
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.bezierCurveTo(
                                p.x + (Math.random() - 0.5) * 20, p.y + 10,
                                p.x + (Math.random() - 0.5) * 30, p.y + 20,
                                p.x + (Math.random() - 0.5) * 15, p.y + 30 + Math.random() * 20
                            );
                            ctx.stroke();
                        }
                    });
                } else {
                    ctx.beginPath();
                    ctx.moveTo(fb.nose.x, fb.nose.y);
                    ctx.lineTo(fb.nose.x, fb.nose.y + 50);
                    ctx.stroke();
                }
                break;

            case 4: // Kumis Kucing (Cat Whiskers)
                setupMarker('black', 3);
                if (useLandmarks) {
                    const nose = faceLandmarks.getNose();
                    const leftCheekInner = mapPoint(nose[4]); // Left nostril edge
                    const rightCheekInner = mapPoint(nose[8]); // Right nostril edge

                    // Shorter Whiskers (Reduced length from ~80 to ~45)
                    // Left Whiskers
                    drawRotated(leftCheekInner.x - 10, leftCheekInner.y + 5, cropState.rotation, () => {
                        ctx.beginPath();
                        ctx.moveTo(0, 0); ctx.quadraticCurveTo(-20, -5, -45, -15);
                        ctx.moveTo(0, 5); ctx.quadraticCurveTo(-25, 5, -50, 0);
                        ctx.moveTo(0, 10); ctx.quadraticCurveTo(-20, 15, -45, 20);
                        ctx.stroke();
                    });

                    // Right Whiskers
                    drawRotated(rightCheekInner.x + 10, rightCheekInner.y + 5, cropState.rotation, () => {
                        ctx.beginPath();
                        ctx.moveTo(0, 0); ctx.quadraticCurveTo(20, -5, 45, -15);
                        ctx.moveTo(0, 5); ctx.quadraticCurveTo(25, 5, 50, 0);
                        ctx.moveTo(0, 10); ctx.quadraticCurveTo(20, 15, 45, 20);
                        ctx.stroke();
                    });

                } else {
                    // Fallback without landmarks
                    const nx = w * 0.5;
                    const ny = h * 0.6;

                    // Left
                    ctx.beginPath();
                    ctx.moveTo(nx - 20, ny); ctx.lineTo(nx - 50, ny - 5);
                    ctx.moveTo(nx - 20, ny + 10); ctx.lineTo(nx - 55, ny + 10);
                    ctx.moveTo(nx - 20, ny + 20); ctx.lineTo(nx - 50, ny + 25);
                    ctx.stroke();

                    // Right
                    ctx.beginPath();
                    ctx.moveTo(nx + 20, ny); ctx.lineTo(nx + 50, ny - 5);
                    ctx.moveTo(nx + 20, ny + 10); ctx.lineTo(nx + 55, ny + 10);
                    ctx.moveTo(nx + 20, ny + 20); ctx.lineTo(nx + 50, ny + 25);
                    ctx.stroke();
                }
                break;

            case 5: // Tompel Dagu Kanan
                setupMarker('#3d2b1f', 0);
                if (useLandmarks) {
                    const chinRight = mapPoint(faceLandmarks.positions[10]);
                    drawRotated(chinRight.x - 10, chinRight.y - 10, cropState.rotation, () => {
                        const mx = 0;
                        const my = 0;
                        ctx.fillStyle = '#3d2b1f';
                        ctx.beginPath();
                        ctx.arc(mx, my, 12, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1;
                        for (let i = 0; i < 3; i++) {
                            ctx.beginPath();
                            ctx.moveTo(mx, my);
                            ctx.quadraticCurveTo(mx + 5, my + 10, mx + (Math.random() - 0.5) * 15, my + 25);
                            ctx.stroke();
                        }
                    });
                } else {
                    const mx = w * 0.7;
                    const my = h * 0.85;
                    ctx.fillStyle = '#3d2b1f';
                    ctx.beginPath();
                    ctx.arc(mx, my, 10, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // Function to calculate where the slap should go
    function calculateSlapTarget() {
        if (!faceLandmarks) return null;

        const w = canvas.width;
        const h = canvas.height;

        // 1. Random Zone Selection - CENTERING STRATEGY
        const zones = [
            // Left Cheek
            { id: 'cheekL_high', idx: 27, offset: { x: -w * 0.15, y: h * 0.02 }, flip: false },
            { id: 'cheekL_low', idx: 31, offset: { x: -w * 0.12, y: h * 0.05 }, flip: false },
            // Right Cheek
            { id: 'cheekR_high', idx: 27, offset: { x: w * 0.15, y: h * 0.02 }, flip: true },
            { id: 'cheekR_low', idx: 35, offset: { x: w * 0.12, y: h * 0.05 }, flip: true },
            // Forehead
            { id: 'forehead_mid', idx: 27, offset: { x: 0, y: -h * 0.12 }, flip: Math.random() > 0.5 },
            // Chin
            { id: 'chin', idx: 57, offset: { x: 0, y: h * 0.05 }, flip: Math.random() > 0.5 }
        ];

        let bestTx = 0, bestTy = 0, bestSize = 0, bestZone = null;
        let foundSpot = false;

        for (let attempt = 0; attempt < 50; attempt++) {
            const zone = zones[Math.floor(Math.random() * zones.length)];
            const landmark = faceLandmarks.positions[zone.idx];
            const point = mapPoint(landmark);

            const jitterX = (Math.random() - 0.5) * (w * 0.05);
            const jitterY = (Math.random() - 0.5) * (h * 0.05);

            const tx = point.x + zone.offset.x + jitterX;
            const ty = point.y + zone.offset.y + jitterY;
            const size = w * 0.2;

            // Collision Check
            let overlap = false;
            for (const slap of placedSlaps) {
                const dx = tx - slap.x;
                const dy = ty - slap.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < (size + slap.size) * 0.3) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                bestTx = tx;
                bestTy = ty;
                bestSize = size;
                bestZone = zone;
                foundSpot = true;
                break;
            }
        }

        if (foundSpot) {
            placedSlaps.push({ x: bestTx, y: bestTy, size: bestSize });
            return { x: bestTx, y: bestTy, size: bestSize, zone: bestZone };
        }

        return null;
    }

    function applySlap(targetData) {
        console.log("Applying slap...");
        // alert("DEBUG: Slap function called!"); // Uncomment if needed for desperate debugging
        if (!faceLandmarks) {
            alert("Wajah belum terdeteksi sempurna bun!");
            return;
        }
        if (!targetData) {
            console.warn("No space for slap!");
            return;
        }

        const rot = cropState.rotation;

        ctx.save();

        // Draw Handprint
        drawRotated(targetData.x, targetData.y, rot + (targetData.zone.flip ? 0.2 : -0.2), () => {
            ctx.globalAlpha = 0.7;
            ctx.globalCompositeOperation = 'multiply';

            if (targetData.zone.flip) {
                ctx.scale(-1, 1);
            }

            ctx.drawImage(slapMarkImg, -targetData.size / 2, -targetData.size / 2, targetData.size, targetData.size);
        });

        ctx.restore();
    }

    function drawRotated(x, y, angle, drawFn) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        drawFn();
        ctx.restore();
    }

    // --- POOP LOGIC ---

    function calculatePoopTarget() {
        if (!faceLandmarks) return null;

        const w = canvas.width;
        const h = canvas.height;

        // Zones: Forehead (Center), Cheeks
        const zones = [
            { idx: 27, offset: { x: 0, y: -h * 0.15 } }, // Forehead
            { idx: 2, offset: { x: 0, y: 0 } }, // Cheek Left
            { idx: 14, offset: { x: 0, y: 0 } } // Cheek Right
        ];

        let bestTx = 0, bestTy = 0, bestSize = 0;
        let foundSpot = false;

        for (let attempt = 0; attempt < 50; attempt++) {
            const zone = zones[Math.floor(Math.random() * zones.length)];
            const landmark = faceLandmarks.positions[zone.idx];
            const point = mapPoint(landmark);

            const jitterX = (Math.random() - 0.5) * (w * 0.1);
            const jitterY = (Math.random() - 0.5) * (h * 0.1);

            const tx = point.x + zone.offset.x + jitterX;
            const ty = point.y + zone.offset.y + jitterY;
            const size = w * 0.15; // Poop size

            // Collision Check
            let overlap = false;
            for (const item of [...placedSlaps, ...placedEggs, ...placedPoops]) {
                const dx = tx - item.x;
                const dy = ty - item.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Reduced radius multiplier from 0.5 to 0.25 to allow more overlap/crowding
                if (dist < (size + (item.size || size)) * 0.25) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                bestTx = tx;
                bestTy = ty;
                bestSize = size;
                foundSpot = true;
                break;
            }
        }

        if (foundSpot) {
            placedPoops.push({ x: bestTx, y: bestTy, size: bestSize });
            return { x: bestTx, y: bestTy, size: bestSize };
        }
        return null;
    }

    function applyPoop(target) {
        const poopImg = new Image();
        poopImg.src = 'poop_splat.png';
        poopImg.onload = () => {
            ctx.save();
            ctx.translate(target.x, target.y);
            // Random rotation
            ctx.rotate((Math.random() - 0.5) * 1);
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 10;
            ctx.drawImage(poopImg, -target.size / 2, -target.size / 2, target.size, target.size);
            ctx.restore();
        };
    }

    function spawnFlies(target) {
        const container = document.getElementById('flyContainer');
        const numFlies = Math.floor(Math.random() * 2) + 2; // 2-3 flies

        // Convert internal canvas coords to visual coords
        const canvas = document.getElementById('prankCanvas');
        const visualContainer = document.getElementById('canvas-container');
        const rect = canvas.getBoundingClientRect();
        const containerRect = visualContainer.getBoundingClientRect();

        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        const offsetX = rect.left - containerRect.left;
        const offsetY = rect.top - containerRect.top;

        const visualX = (target.x * scaleX) + offsetX;
        const visualY = (target.y * scaleY) + offsetY;

        for (let i = 0; i < numFlies; i++) {
            const fly = document.createElement('div');
            fly.classList.add('fly', 'fly-active');

            // Random start position around the target
            const startX = visualX + (Math.random() - 0.5) * 100;
            const startY = visualY + (Math.random() - 0.5) * 100;

            fly.style.left = `${startX}px`;
            fly.style.top = `${startY}px`;

            container.appendChild(fly);

            // After random time, make them land (stop buzzing) and move closer to poop
            const landTime = 2000 + Math.random() * 1500;
            setTimeout(() => {
                fly.classList.remove('fly-active');

                // Move to random spot ON the poop
                const landX = visualX + (Math.random() - 0.5) * 30;
                const landY = visualY + (Math.random() - 0.5) * 30;

                fly.style.transition = "all 0.5s ease";
                fly.style.left = `${landX}px`;
                fly.style.top = `${landY}px`;

                // Random rotation for landing
                fly.style.transform = `rotate(${Math.random() * 360}deg)`;

            }, landTime);
        }
    }

    // --- STAMP LOGIC ---

    function calculateStampTarget() {
        if (!faceLandmarks) return null;

        const w = canvas.width;
        const h = canvas.height;

        // Zones: Prioritize Forehead (idx 27 is between eyes, 19-24 are eyebrows)
        // We approximate forehead by going UP from the nose bridge (27)
        const noseBridgeTop = faceLandmarks.positions[27];
        const point = mapPoint(noseBridgeTop);

        // Define a "Forehead Box" area
        // Shift up by 15-25% of height

        let bestTx = 0, bestTy = 0, bestSize = 0;
        let foundSpot = false;

        for (let attempt = 0; attempt < 20; attempt++) {
            // Randomize position on forehead
            const jitterX = (Math.random() - 0.5) * (w * 0.2);
            // Y is biased to be ABOVE the eyes
            const jitterY = - (h * 0.1) + (Math.random() - 0.5) * (h * 0.1);

            const tx = point.x + jitterX;
            const ty = point.y + jitterY;
            const size = w * 0.35; // Stamps are BIG

            // Collision Check
            let overlap = false;
            for (const item of [...placedSlaps, ...placedEggs, ...placedPoops, ...placedStamps]) {
                const dx = tx - item.x;
                const dy = ty - item.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < (size + (item.size || size)) * 0.4) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                bestTx = tx;
                bestTy = ty;
                bestSize = size;
                foundSpot = true;
                break;
            }
        }

        if (foundSpot) {
            placedStamps.push({ x: bestTx, y: bestTy, size: bestSize });
            return { x: bestTx, y: bestTy, size: bestSize };
        }
        return null;
    }

    function applyStamp(target, stampSrc) {
        const img = new Image();
        img.src = stampSrc;

        // Play audio if available (TODO)

        // Screen Shake Logic (Re-used)
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.classList.remove('shake-hard');
        void canvasContainer.offsetWidth; // trigger reflow
        canvasContainer.classList.add('shake-hard');
        setTimeout(() => {
            canvasContainer.classList.remove('shake-hard');
        }, 500);

        img.onload = () => {
            ctx.save();
            ctx.translate(target.x, target.y);
            // Random rotation (-15 to +15 deg)
            const angle = (Math.random() - 0.5) * 0.5;
            ctx.rotate(angle);

            // "Multiply" blend mode makes ink look like it's ON the skin
            ctx.globalCompositeOperation = 'multiply';
            // Slight opacity for realism
            ctx.globalAlpha = 0.9;

            ctx.drawImage(img, -target.size / 2, -target.size / 2, target.size, target.size / 2.5); // Aspect ratio fix (stamps are rectangular)

            ctx.restore();
        };
    }

    function setupMarker(color, width) {
        const relWidth = Math.max(2, (canvas.width / 500) * (width || 5));
        ctx.strokeStyle = color;
        ctx.lineWidth = relWidth;
        ctx.globalAlpha = 0.85;
    }
});
