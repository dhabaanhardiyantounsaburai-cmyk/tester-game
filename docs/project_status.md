# Tasks

## Phase 1: Core Mechanics & Assets (Completed)
- [x] **Restore High-Quality Effects** <!-- id: 4 -->
    - [x] Slap (Animation + Handprint) <!-- id: 5 -->
    - [x] Poop (Image + Rotation) <!-- id: 6 -->
    - [x] Makeup (Full Suite: Lipstick, Bruise, Panda Eyes, etc.) <!-- id: 7 -->
    - [x] Warp (Penyokin Wajah - Ported from V1) <!-- id: 8 -->
    - [x] Punch (BUGH! Text + Bruise) <!-- id: 9 -->
- [x] **System Stability (Offline Mode)** <!-- id: 10 -->
    - [x] Download Model Weights locally (`/weights`) <!-- id: 11 -->
    - [x] Download `face-api.min.js` locally <!-- id: 12 -->
    - [x] Robust Error Handling (Red Box on crash) <!-- id: 13 -->
- [x] **Final Polish** <!-- id: 14 -->
    - [x] Remove Debug Logger <!-- id: 15 -->
    - [x] Verify Battle Flow <!-- id: 16 -->
- [x] Implement Dynamic Text Stamps (Gender/Age based) <!-- id: 6 -->
- [x] Display Detected Age & Gender below photo <!-- id: 7 -->
- [x] Fine-tune Stamp Word Probabilities (Deck System) <!-- id: 8 -->
- [x] Improve Stamp Visibility (Shadows & Brighter Colors) <!-- id: 9 -->
- [x] Implement Face Warp Logic (Magnify/Pinch/Stretch) <!-- id: 10 -->
- [x] Add "PENYOKIN WAJAH" button to UI <!-- id: 11 -->
- [x] Integrate Random Warp Effects (Big Eyes, Thick Lips, etc.) <!-- id: 12 -->
- [x] Integrate Realistic Makeup Assets (Pimple, Snot, etc.) <!-- id: 13 -->
- [x] Refine Makeup Positioning & Aesthetics (Menor Lipstick, Giant Pimple) <!-- id: 14 -->

## Phase 2: Battle Mode (Suit Jepang) - Player MUST Selfie
- [ ] **Implement Webcam Logic** <!-- id: 19 -->
    - [ ] Request Camera Permissions.
    - [ ] Video Stream -> Capture Image Canvas.
- [ ] **Restructure UI for Split Screen** <!-- id: 15 -->
    - [ ] Create Player Canvas (Left) & Enemy Canvas (Right).
    - [ ] **Player Input**: Webcam Live Stream + "Capture Selfie" Button.
    - [ ] **Enemy Input**: File Upload (for the friend/victim).
- [ ] **Implement Game Logic (Suit)** <!-- id: 16 -->
    - [ ] Add Gunting/Batu/Kertas buttons.
    - [ ] Implement Win/Lose/Draw logic against CPU.
- [ ] **Implement Punishment System** <!-- id: 17 -->
    - [ ] Manual Torture: If Player wins, unlock buttons for Enemy.
    - [ ] Auto Torture: If Player loses, AI randomly picks effect for Player.
- [ ] **Game Loop & Polish** <!-- id: 18 -->
    - [ ] Add HP/Torture Limit (e.g., First to 5 bruises loses).
    - [ ] Add "Game Over" Screen with Winner declaration.
