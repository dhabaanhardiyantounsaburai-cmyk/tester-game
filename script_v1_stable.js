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

    // --- WARP GLOBALS ---
    let currentStepWarp = 0;
    const appliedEffects = [];
    const conflictGroups = {
        'eyes': ['big_eyes', 'small_eyes'],
        'mouth': ['big_mouth', 'small_mouth'],
        'nose': ['big_nose', 'small_nose'],
        'chin': ['long_chin'],
        'forehead': ['big_forehead'],
        'cheeks': ['fat_cheeks'],
        'face': ['twist_face']
    };

    // --- MAKEUP GLOBALS ---
    let currentStepMakeup = 0;
    const appliedMakeup = [];

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

        // Reset Warp State
        currentStepWarp = 0;
        appliedEffects.length = 0; // Clear array
        if (warpBtn) {
            warpBtn.disabled = false;
            warpBtn.textContent = "🥴 PENYOKIN WAJAH!";
            warpBtn.style.background = "linear-gradient(45deg, #9C27B0, #7B1FA2)"; // Restore color
        }

        // Reset Makeup State
        currentStepMakeup = 0;
        appliedMakeup.length = 0;
        const makeupBtn = document.getElementById('makeupBtn');
        if (makeupBtn) {
            makeupBtn.disabled = false;
            makeupBtn.textContent = "💄 MAKEUP CEMONG!";
            makeupBtn.style.background = "linear-gradient(45deg, #E91E63, #C2185B)";
        }

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
                // Attach Age & Gender to the landmarks object for global access
                faceLandmarks.gender = detection.gender;
                faceLandmarks.age = detection.age;

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

                // --- SHOW DETECTED STATUS ---
                const statusDiv = document.getElementById('faceStatus');
                if (statusDiv) {
                    const gender = faceLandmarks.gender || 'Unknown';
                    const age = Math.round(faceLandmarks.age || 0);
                    const genderIndo = gender === 'male' ? 'Laki-laki' : (gender === 'female' ? 'perempuan' : 'Tidak diketahui');

                    statusDiv.innerHTML = `🕵️ Deteksi AI: <b>${genderIndo}</b> (${age} thn)`;
                    statusDiv.classList.remove('hidden');
                }

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
            stampBtn.disabled = currentStepStamp >= 5; // Max 5 stamps
            stampBtn.textContent = currentStepStamp >= 5 ? "PENUH CAP!" : "🛑 STEMPEL JIDAT!";
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

    // --- STAMP WORD DICTIONARY ---
    const STAMP_WORDS = {
        MALE: ['BUAYA DARAT', 'FAKBOY', 'RAJA HUTANG', 'AUTO JOMBLO', 'WIBU BAU BAWANG', 'SOK GANTENG', 'MODUS', 'PENIPU CINTA', 'Playboy Cap Kabel', 'Muka Pas-pasan'],
        FEMALE: ['ANI-ANI', 'RATU DRAMA', 'PICK ME GIRL', 'MATERIALISTIS', 'CABE-CABEAN', 'SOK CANTIK', 'JUDES', 'PELAKOR', 'Tukang Ghosting', 'Beban Pacar'],
        CHILD: ['BOCIL KEMATIAN', 'BEBAN ORTU', 'CALON JAMET', 'GENERASI TIKTOK', 'SUSAH DIATUR', 'Suka Maling Mangga', 'Kebanyakan Micin', 'Top Global Nangis', 'Bau Kencur', 'Kurang Gizi'],
        ADULT: ['BEBAN KELUARGA', 'PENGANGGURAN', 'SALAH PERGAULAN', 'SUSAH JODOH', 'TUA KELADI', 'Muka Boros', 'Kurang Piknik', 'Kebanyakan Cicilan', 'Mental Tempe', 'Sobat Misqueen'],
        GENERAL: ['MALING GORENGAN', 'JOMBLO AKUT', 'KEBANYAKAN GAYA', 'LEPEHAN MANTAN', 'BURONAN DEBT COLLECTOR', 'TIKTOKER GAK LAKU', 'PEMBAWA SIAL', 'MUKA MELAS', 'Bau Tanah', 'Gak Punya Akhlak']
    };

    let stampDeck = [];

    function getRandom(arr, n) {
        let result = new Array(n),
            len = arr.length,
            taken = new Array(len);
        if (n > len)
            throw new RangeError("getRandom: more elements taken than available");
        while (n--) {
            let x = Math.floor(Math.random() * len);
            result[n] = arr[x in taken ? taken[x] : x];
            taken[x] = --len in taken ? taken[len] : len;
        }
        return result;
    }

    const stampBtn = document.getElementById('stampBtn');
    if (stampBtn) {
        stampBtn.addEventListener('click', () => {
            // Limit to 5 stamps
            if (currentStepStamp >= 5) return;

            // 1. Determine "Aib" based on Gender & Age
            let stampText = "BURONAN"; // Default

            if (faceLandmarks) {
                const gender = faceLandmarks.gender || 'neutral';
                const age = faceLandmarks.age || 20;

                // Select categories to mix
                let possibleWords = [...STAMP_WORDS.GENERAL];

                // Gender specific
                if (gender === 'male') possibleWords.push(...STAMP_WORDS.MALE);
                else if (gender === 'female') possibleWords.push(...STAMP_WORDS.FEMALE);

                // Age specific
                if (age < 17) possibleWords.push(...STAMP_WORDS.CHILD);
                else possibleWords.push(...STAMP_WORDS.ADULT);

                // FILTER: Exclude already used words in this session
                const usedWords = placedStamps.map(s => s.text).filter(t => t);
                const availableWords = possibleWords.filter(w => !usedWords.includes(w.toUpperCase()));

                // Fallback if we ran out of unique words (unlikely)
                const pool = availableWords.length > 0 ? availableWords : possibleWords;

                // Pick one random word
                stampText = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
            } else {
                // Fallback
                const general = [...STAMP_WORDS.GENERAL, ...STAMP_WORDS.MALE, ...STAMP_WORDS.FEMALE];
                // Filter duplicates
                const usedWords = placedStamps.map(s => s.text).filter(t => t);
                const availableWords = general.filter(w => !usedWords.includes(w.toUpperCase()));
                const pool = availableWords.length > 0 ? availableWords : general;

                stampText = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
            }

            // 2. Calculate Target
            const targetData = calculateStampTarget();

            if (!targetData) {
                alert("Area stempel penuh bro!");
                return;
            }

            // 3. Apple Stamp
            currentStepStamp++;

            // Store text for future duplicate check
            // We need to attach the text to the placed item we just pushed in calculateStampTarget
            if (placedStamps.length > 0) {
                placedStamps[placedStamps.length - 1].text = stampText;
            }

            // Pass TEXT instead of image src
            applyStamp(targetData, stampText);
            updateUI();
        });
    }

    // ... (slapBtn listener remains same)

    // ... (calculateStampTarget remains same)

    function applyStamp(target, text) {
        // Screen Shake Logic
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.classList.remove('shake-hard');
        void canvasContainer.offsetWidth; // trigger reflow
        canvasContainer.classList.add('shake-hard');
        setTimeout(() => {
            canvasContainer.classList.remove('shake-hard');
        }, 500);

        ctx.save();
        ctx.translate(target.x, target.y);

        // Random rotation (-15 to +15 deg)
        const angle = (Math.random() - 0.5) * 0.5;
        ctx.rotate(angle);

        // Styling for Text Stamp
        ctx.font = `bold ${target.size * 0.4}px Impact, "Arial Black", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Random Color (Red or Blue ink)
        const colors = ['#8B0000', '#00008B', '#B22222'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        // "Multiply" mode makes it blend like ink
        ctx.globalCompositeOperation = 'multiply';

        // Draw Text Box Border (Stamp Box)
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = target.size * 0.5; // Approximate height
        const pad = target.size * 0.1;

        ctx.lineWidth = target.size * 0.05;

        // DRAW TWICE for BOLD effect (Double Ink)
        // Pass 1
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(-textWidth / 2 - pad, -textHeight / 2, textWidth + pad * 2, textHeight);
        ctx.fillText(text, 0, 0);

        // Pass 2 (Reinforce)
        ctx.globalAlpha = 0.6;
        ctx.strokeRect(-textWidth / 2 - pad, -textHeight / 2, textWidth + pad * 2, textHeight);
        ctx.fillText(text, 0, 0);

        ctx.restore();
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
        const w = canvas.width;
        const h = canvas.height;

        // Calculate Face Bounding Box to AVOID
        let faceBox = null;
        if (faceLandmarks) {
            const jaw = faceLandmarks.getJawOutline().map(mapPoint);
            const leftBrow = faceLandmarks.getLeftEyeBrow().map(mapPoint);
            const rightBrow = faceLandmarks.getRightEyeBrow().map(mapPoint);

            // Get simplified min/max bounds
            let minX = w, minY = h, maxX = 0, maxY = 0;
            const allPoints = [...jaw, ...leftBrow, ...rightBrow];

            allPoints.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });

            // Add padding to face box (so stempel doesn't touch edges of face)
            const pad = w * 0.05;
            faceBox = {
                x: minX - pad,
                y: minY - pad * 2, // More padding on top (hair)
                w: (maxX - minX) + pad * 2,
                h: (maxY - minY) + pad * 2
            };
        }

        let bestTx = 0, bestTy = 0, bestSize = 0;
        let foundSpot = false;

        for (let attempt = 0; attempt < 50; attempt++) {
            const size = w * 0.25;
            const padding = size * 0.6;

            const tx = padding + Math.random() * (w - padding * 2);
            const ty = padding + Math.random() * (h - padding * 2);

            // 1. Face Avoidance Check
            if (faceBox) {
                // Approximate stamp as a square center point for simplicity
                // If the center of the stamp is inside the face box, retry
                if (tx > faceBox.x && tx < faceBox.x + faceBox.w &&
                    ty > faceBox.y && ty < faceBox.y + faceBox.h) {
                    continue; // Skip, it's on the face!
                }
            }

            bestTx = tx;
            bestTy = ty;
            bestSize = size;

            // 2. Collision Check (Existing)
            let overlap = false;
            for (const item of [...placedSlaps, ...placedEggs, ...placedPoops, ...placedStamps]) {
                const dx = tx - item.x;
                const dy = ty - item.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < (size + (item.size || size)) * 0.3) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                foundSpot = true;
                break;
            }
        }

        // Force placement (even if overlapping is unavoidable, but we prioritized avoiding face first)
        placedStamps.push({ x: bestTx, y: bestTy, size: bestSize });
        return { x: bestTx, y: bestTy, size: bestSize };
    }

    function applyStamp(target, text) {
        // Screen Shake Logic
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.classList.remove('shake-hard');
        void canvasContainer.offsetWidth; // trigger reflow
        canvasContainer.classList.add('shake-hard');
        setTimeout(() => {
            canvasContainer.classList.remove('shake-hard');
        }, 500);

        ctx.save();
        ctx.translate(target.x, target.y);

        // Random rotation (-15 to +15 deg)
        const angle = (Math.random() - 0.5) * 0.5;
        ctx.rotate(angle);

        // Styling for Text Stamp
        // REDUCED SIZE: Was 0.35, now 0.13 (Much smaller & crisp)
        const fontSize = target.size * 0.13;
        ctx.font = `900 ${fontSize}px "Arial Black", "Arial", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Random Color (Brighter for visibility on dark hair)
        // Red, Blue, Purple (Brighter variants)
        const colors = ['#D90429', '#03045E', '#7209B7'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        // VISIBILITY FIX: Use 'source-over' instead of 'multiply' to sit ON TOP of hair
        ctx.globalCompositeOperation = 'source-over';

        // Add White Shadow/Glow to separate text from dark background
        ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
        ctx.shadowBlur = fontSize * 0.5;

        // Draw Text Box Border (Stamp Box)
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        // Adjust box height to fit new font size
        const textHeight = fontSize * 1.6;
        const pad = fontSize * 0.4;

        ctx.lineWidth = fontSize * 0.15; // Proportional border

        // DRAW
        // Pass 1 (Base)
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(-textWidth / 2 - pad, -textHeight / 2, textWidth + pad * 2, textHeight);
        ctx.fillText(text, 0, 0);

        // Reset Shadow for subsequent draws
        ctx.shadowBlur = 0;

        // Pass 2 (Reinforce contrast)
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(-textWidth / 2 - pad, -textHeight / 2, textWidth + pad * 2, textHeight);
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }

    // --- WARP EFFECTS LOGIC ---
    // currentStepWarp is now global at top
    const warpBtn = document.getElementById('warpBtn');

    function getCenter(points) {
        let sumX = 0, sumY = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
        }
        return { x: sumX / points.length, y: sumY / points.length };
    }

    if (warpBtn) {
        warpBtn.addEventListener('click', () => {
            // 1. Check Limits
            if (currentStepWarp >= 5) {
                alert("Wajah sudah hancur maksimal bro! 😂");
                return;
            }
            // 2. Check Face
            if (!faceLandmarks) {
                alert("Wajah tidak terdeteksi, jadi gak bisa dipenyokin!");
                return;
            }

            // 3. Pick Random Effect
            const effects = [
                'big_eyes', 'small_eyes', 'big_mouth', 'small_mouth',
                'big_nose', 'small_nose', 'long_chin', 'big_forehead',
                'fat_cheeks', 'twist_face'
            ];
            const effect = effects[Math.floor(Math.random() * effects.length)];

            // 4. Apply
            applyWarpEffect(effect);
            currentStepWarp++;

            // 5. Update Button State
            warpBtn.textContent = `🥴 PENYOK (${currentStepWarp}/5)`;

            if (currentStepWarp >= 5) {
                warpBtn.textContent = "WAJAH HANCUR!";
                warpBtn.disabled = true;
                warpBtn.style.background = "#555";
            }
        });
    }

    function applyWarpEffect(effect) {
        // HELPER: Map source coordinates to cropped canvas coordinates
        const map = p => ({ x: p.x - cropState.x, y: p.y - cropState.y });

        // Find centers with offset mapping
        const leftEye = map(getCenter(faceLandmarks.getLeftEye()));
        const rightEye = map(getCenter(faceLandmarks.getRightEye()));
        const mouth = map(getCenter(faceLandmarks.getMouth()));
        const nose = map(getCenter(faceLandmarks.getNose()));

        const jawRaw = faceLandmarks.getJawOutline();
        const jaw = jawRaw.map(p => map(p));

        const chin = jaw[8]; // Bottom point
        const leftCheek = jaw[4];
        const rightCheek = jaw[12];

        // Scale strength relative to face size
        const faceWidth = Math.abs(jaw[16].x - jaw[0].x);
        const refSize = faceWidth * 0.2;

        // Screen Shake for impact
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.classList.remove('shake-hard');
        void canvasContainer.offsetWidth;
        canvasContainer.classList.add('shake-hard');
        setTimeout(() => canvasContainer.classList.remove('shake-hard'), 500);

        console.log("Applying Warp:", effect, "RefSize:", refSize);

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
            case 'small_mouth':
                warpPixels(mouth.x, mouth.y, refSize * 1.5, 0.8, 'pinch');
                break;
            case 'big_nose':
                warpPixels(nose.x, nose.y, refSize * 1.2, 0.6, 'magnify');
                break;
            case 'small_nose':
                warpPixels(nose.x, nose.y, refSize * 1.5, 0.8, 'pinch');
                break;
            case 'long_chin':
                warpPixels(chin.x, chin.y - refSize, refSize * 2, 0.8, 'stretch_down');
                break;
            case 'big_forehead':
                // Estimate forehead (above eyes)
                const foreheadY = (leftEye.y + rightEye.y) / 2 - refSize * 1.5;
                const foreheadX = (leftEye.x + rightEye.x) / 2;
                warpPixels(foreheadX, foreheadY, refSize * 2.5, 0.5, 'magnify');
                break;
            case 'fat_cheeks':
                warpPixels(leftCheek.x + refSize * 0.5, leftCheek.y, refSize * 2, 0.4, 'magnify');
                warpPixels(rightCheek.x - refSize * 0.5, rightCheek.y, refSize * 2, 0.4, 'magnify');
                break;
            case 'twist_face':
                const centerX = (leftEye.x + rightEye.x + mouth.x) / 3;
                const centerY = (leftEye.y + rightEye.y + mouth.y) / 3;
                warpPixels(centerX, centerY, faceWidth * 0.7, 1.5, 'twist');
                break;
        }
    }

    function warpPixels(cx, cy, radius, strength, mode = 'magnify') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const radiusSq = radius * radius;

        // Create a copy to sample from (so we don't sample modified pixels)
        const sourceBuffer = new Uint8ClampedArray(data);

        const xMin = Math.max(0, Math.floor(cx - radius));
        const xMax = Math.min(width, Math.ceil(cx + radius));
        const yMin = Math.max(0, Math.floor(cy - radius));
        const yMax = Math.min(height, Math.ceil(cy + radius));

        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const distSq = dx * dx + dy * dy;

                if (distSq < radiusSq) {
                    const dist = Math.sqrt(distSq);
                    let sourceX = x;
                    let sourceY = y;

                    // WARP MATH
                    if (mode === 'magnify') {
                        // Fish-eye effect: pull pixels away from center
                        // Mapped radius: r' = r * (1 - strength * (1 - r/R)^2)
                        // Actually simple standard formula: r_src = r_dest * (1 + strength * function)
                        // Let's use simple interpolation
                        const factor = Math.pow(dist / radius, strength) * dist / radius; // Non-linear
                        // Simpler approach:
                        // amount = (1 - dist/radius) * strength
                        // ox = dx * amount
                        // oy = dy * amount
                        // sourceX = x - ox
                        const amount = strength * (1 - dist / radius);
                        sourceX = x - dx * amount;
                        sourceY = y - dy * amount;
                    } else if (mode === 'pinch') {
                        // Shrink effect: pull pixels towards center
                        const amount = strength * (1 - dist / radius);
                        sourceX = x + dx * amount;
                        sourceY = y + dy * amount;
                    } else if (mode === 'stretch_down') {
                        // Drag down
                        const amount = strength * (1 - dist / radius);
                        sourceY = y - amount * radius; // Look UP for source
                    } else if (mode === 'twist') {
                        // Swirl
                        const angle = strength * (1 - dist / radius);
                        const sin = Math.sin(angle);
                        const cos = Math.cos(angle);
                        sourceX = cx + dx * cos - dy * sin;
                        sourceY = cy + dx * sin + dy * cos;
                    }

                    // Bilinear Interpolation for smoothness
                    if (sourceX >= 0 && sourceX < width - 1 && sourceY >= 0 && sourceY < height - 1) {
                        const x0 = Math.floor(sourceX);
                        const x1 = x0 + 1;
                        const y0 = Math.floor(sourceY);
                        const y1 = y0 + 1;

                        const sx = sourceX - x0;
                        const sy = sourceY - y0;

                        const iDst = (y * width + x) * 4;
                        const i00 = (y0 * width + x0) * 4;
                        const i10 = (y0 * width + x1) * 4;
                        const i01 = (y1 * width + x0) * 4;
                        const i11 = (y1 * width + x1) * 4;

                        for (let c = 0; c < 4; c++) {
                            const val0 = sourceBuffer[i00 + c] * (1 - sx) + sourceBuffer[i10 + c] * sx;
                            const val1 = sourceBuffer[i01 + c] * (1 - sx) + sourceBuffer[i11 + c] * sx;
                            data[iDst + c] = val0 * (1 - sy) + val1 * sy;
                        }
                    }
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // --- MAKEUP EFFECTS LOGIC ---
    const makeupBtn = document.getElementById('makeupBtn');
    if (makeupBtn) {
        makeupBtn.addEventListener('click', () => {
            if (currentStepMakeup >= 5) {
                alert("Mukanya udah cemong banget bro! 😂");
                return;
            }
            if (!faceLandmarks) {
                alert("Wajah belum terdeteksi! Upload dulu.");
                return;
            }

            const allEffects = [
                'lipstick_menor', 'alis_sinchan', 'blush_demam', 'mata_panda',
                'shadow_lebam', 'air_liur', 'jenggot_kambing', 'ingus_meler',
                'unibrow', 'jerawat_raksasa'
            ];

            // Filter duplicates
            let availableEffects = allEffects.filter(e => !appliedMakeup.includes(e));

            // CONFLICT RESOLUTION: Prevent 'mata_panda' and 'shadow_lebam' overlap
            if (appliedMakeup.includes('mata_panda')) {
                availableEffects = availableEffects.filter(e => e !== 'shadow_lebam');
            }
            if (appliedMakeup.includes('shadow_lebam')) {
                availableEffects = availableEffects.filter(e => e !== 'mata_panda');
            }

            if (availableEffects.length === 0) {
                alert("Udah semua gaya dicoba bro! 😂");
                return;
            }

            const effect = availableEffects[Math.floor(Math.random() * availableEffects.length)];

            applyMakeupEffect(effect);
            appliedMakeup.push(effect);
            currentStepMakeup++;

            makeupBtn.textContent = `💄 CEMONG (${currentStepMakeup}/5)`;

            if (currentStepMakeup >= 5) {
                makeupBtn.textContent = "FULL CEMONG!";
                makeupBtn.disabled = true;
                makeupBtn.style.background = "#555";
            }
        });
    }

    // Preload Makeup Assets
    const pimpleImg = new Image(); pimpleImg.src = 'fix_bisul.png';
    const droolImg = new Image(); droolImg.src = 'fix_drool.png';
    const snotImg = new Image(); snotImg.src = 'fix_snot.png';
    const unibrowImg = new Image(); unibrowImg.src = 'fix_unibrow.png';


    function applyMakeupEffect(effect) {
        // HELPER: Map source coordinates to cropped canvas coordinates
        const map = p => ({ x: p.x - cropState.x, y: p.y - cropState.y });

        ctx.save();

        const mouth = faceLandmarks.getMouth().map(map);
        const leftBrow = faceLandmarks.getLeftEyeBrow().map(map);
        const rightBrow = faceLandmarks.getRightEyeBrow().map(map);
        const leftEye = faceLandmarks.getLeftEye().map(map);
        const rightEye = faceLandmarks.getRightEye().map(map);
        const nose = faceLandmarks.getNose().map(map);
        const jaw = faceLandmarks.getJawOutline().map(map);

        // Helper to get center
        const center = (points) => {
            let sx = 0, sy = 0;
            points.forEach(p => { sx += p.x; sy += p.y; });
            return { x: sx / points.length, y: sy / points.length };
        };

        const faceWidth = Math.abs(jaw[16].x - jaw[0].x);

        console.log("Applying Makeup:", effect);

        switch (effect) {
            case 'lipstick_menor':
                // Use Multiply for realistic tint integration
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = '#B71C1C'; // Deep intense red
                ctx.strokeStyle = '#B71C1C'; // Line color matches fill
                ctx.globalAlpha = 0.85;
                ctx.filter = `blur(${faceWidth * 0.005}px)`; // Very sharp

                // Make lips WIDER by adding stroke (Overlining)
                ctx.lineWidth = faceWidth * 0.05; // Thick stroke to widen area
                ctx.lineJoin = 'round';

                // Upper Lip
                ctx.beginPath();
                ctx.moveTo(mouth[0].x, mouth[0].y);
                for (let i = 1; i <= 6; i++) ctx.lineTo(mouth[i].x, mouth[i].y);
                ctx.lineTo(mouth[16].x, mouth[16].y);
                for (let i = 15; i >= 12; i--) ctx.lineTo(mouth[i].x, mouth[i].y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke(); // Overline upper

                // Lower Lip
                ctx.beginPath();
                ctx.moveTo(mouth[6].x, mouth[6].y);
                for (let i = 7; i <= 11; i++) ctx.lineTo(mouth[i].x, mouth[i].y);
                ctx.lineTo(mouth[0].x, mouth[0].y);
                ctx.lineTo(mouth[12].x, mouth[12].y);
                for (let i = 19; i >= 17; i--) ctx.lineTo(mouth[i].x, mouth[i].y);
                ctx.lineTo(mouth[16].x, mouth[16].y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke(); // Overline lower

                // NO GLOSS (Matte Menor)
                break;

            case 'alis_sinchan':
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = faceWidth * 0.08; // Very thick
                ctx.lineCap = 'round';
                ctx.globalAlpha = 0.9;

                [leftBrow, rightBrow].forEach(brow => {
                    ctx.beginPath();
                    ctx.moveTo(brow[0].x, brow[0].y);
                    for (let i = 1; i < brow.length; i++) ctx.lineTo(brow[i].x, brow[i].y);
                    ctx.stroke();
                });
                break;

            case 'blush_demam':
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = '#D50000'; // Dark Red (Extreme Fever)
                ctx.globalAlpha = 0.6; // More opaque
                ctx.filter = `blur(${faceWidth * 0.06}px)`; // Softer edge but strong center

                // Left Cheek
                ctx.beginPath();
                ctx.arc(jaw[2].x + faceWidth * 0.12, jaw[2].y, faceWidth * 0.13, 0, Math.PI * 2);
                ctx.fill();
                // Right Cheek
                ctx.beginPath();
                ctx.arc(jaw[14].x - faceWidth * 0.12, jaw[14].y, faceWidth * 0.13, 0, Math.PI * 2);
                ctx.fill();
                ctx.filter = 'none';
                break;

            case 'mata_panda':
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = '#000000';
                ctx.globalAlpha = 0.6; // Much darker (Extreme fatigue)
                ctx.filter = `blur(${faceWidth * 0.04}px)`;

                [leftEye, rightEye].forEach(eye => {
                    const c = center(eye);
                    ctx.beginPath();
                    // Wider and darker
                    ctx.ellipse(c.x, c.y + faceWidth * 0.02, faceWidth * 0.14, faceWidth * 0.11, 0, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.filter = 'none';
                break;

            case 'shadow_lebam':
                ctx.globalCompositeOperation = 'multiply';
                // Pick random eye
                const targetEye = Math.random() > 0.5 ? leftEye : rightEye;
                const cEye = center(targetEye);

                // Deep Bruise Gradient
                const grad = ctx.createRadialGradient(cEye.x, cEye.y, faceWidth * 0.02, cEye.x, cEye.y, faceWidth * 0.16);
                grad.addColorStop(0, '#311B92'); // Deep Indigo
                grad.addColorStop(0.5, '#B71C1C'); // Blood Red
                grad.addColorStop(1, 'rgba(74, 20, 140, 0)'); // Purple fade

                ctx.fillStyle = grad;
                ctx.globalAlpha = 0.75; // Very visible
                ctx.filter = `blur(${faceWidth * 0.035}px)`;

                ctx.beginPath();
                ctx.arc(cEye.x, cEye.y, faceWidth * 0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.filter = 'none';
                ctx.globalCompositeOperation = 'source-over';
                break;

            case 'air_liur':
                // IMAGE ASSET: fix_snot.png (Long slime requested as Drool)
                // Position: Under upper lip (mouth[14] is center of inner upper lip)

                // FILTER: Change Color from Green to Blue (Water-like)
                ctx.filter = 'hue-rotate(140deg) brightness(1.2) saturate(0.8)';

                const upperLipCenter = mouth[14];
                const dSize = faceWidth * 0.25;
                // Draw long slime hanging from upper lip
                // Centered X, Y moved UP (0.15) to start "inside" mouth/behind lip
                ctx.drawImage(snotImg, upperLipCenter.x - dSize * 0.5, upperLipCenter.y - dSize * 0.15, dSize, dSize * 2.5);

                ctx.filter = 'none';
                break;

            case 'jenggot_kambing':
                ctx.beginPath();
                const chin = jaw[8];
                ctx.moveTo(chin.x, chin.y);
                // Draw hairy patch
                for (let i = 0; i < 20; i++) {
                    // Randomize direction downwards
                    const angle = Math.PI / 2 + (Math.random() - 0.5);
                    const len = faceWidth * (0.1 + Math.random() * 0.1);
                    const tox = chin.x + Math.cos(angle) * len + (Math.random() - 0.5) * 10;
                    const toy = chin.y + Math.sin(angle) * len;

                    ctx.strokeStyle = '#222';
                    ctx.lineWidth = 2;
                    ctx.moveTo(chin.x + (Math.random() - 0.5) * 20, chin.y);
                    ctx.lineTo(tox, toy);
                }
                ctx.stroke();
                break;

            case 'ingus_meler':
                // IMAGE ASSET: fix_drool.png (Small drop requested as Snot)
                // Position: Nostril
                const nostril = Math.random() > 0.5 ? nose[2] : nose[6];
                const sSize = faceWidth * 0.4; // MASSIVE (40%)
                // Draw small drop from nostril
                // Position UP significantly (-0.6) to put root inside nostril
                ctx.drawImage(droolImg, nostril.x - sSize * 0.5, nostril.y - sSize * 0.6, sSize, sSize * 1.5);
                break;

            case 'unibrow':
                // IMAGE ASSET: unibrow.png
                // Position: Between eyebrows
                const lbInner = leftBrow[leftBrow.length - 1];
                const rbInner = rightBrow[0];
                const midX = (lbInner.x + rbInner.x) / 2;
                const midY = (lbInner.y + rbInner.y) / 2;

                const uWidth = Math.abs(rbInner.x - lbInner.x) * 3.5;
                const uHeight = uWidth * 0.5;

                // Lowered based on feedback (Y - offset reduced to 0.7)
                ctx.drawImage(unibrowImg, midX - uWidth / 2, midY - uHeight * 0.7, uWidth, uHeight);
                break;

            case 'jerawat_raksasa':
                // IMAGE ASSET: fix_bisul.png
                let pimpleX, pimpleY;

                // Position: Side of nose bridge (Higher up)
                if (Math.random() > 0.5) {
                    // Left side bridge
                    const target = nose[0]; // Bridge top/mid
                    pimpleX = target.x - faceWidth * 0.1;
                    pimpleY = target.y + faceWidth * 0.05;
                } else {
                    // Right side bridge
                    const target = nose[4]; // Bridge top/mid
                    pimpleX = target.x + faceWidth * 0.1;
                    pimpleY = target.y + faceWidth * 0.05;
                }

                const pSize = faceWidth * 0.45; // BISUL SIZE (Huge)
                ctx.drawImage(pimpleImg, pimpleX - pSize / 2, pimpleY - pSize / 2, pSize, pSize);
                break;
        }

        ctx.restore();

        // Shake feedback
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.classList.remove('shake-hard');
        void canvasContainer.offsetWidth;
        canvasContainer.classList.add('shake-hard');
        setTimeout(() => canvasContainer.classList.remove('shake-hard'), 500);
    }

    function setupMarker(color, width) {
        const relWidth = Math.max(2, (canvas.width / 500) * (width || 5));
        ctx.strokeStyle = color;
        ctx.lineWidth = relWidth;
        ctx.globalAlpha = 0.85;
    }
});
