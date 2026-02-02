# Wajah Siksaan: Battle Mode Restoration & Offline Update

## Overview
This update focuses on two critical areas: restoring the "fun" high-quality torture effects from the original version and ensuring the game is 100% playable without an internet connection (Offline Mode).

## 🚀 Key Features Added

### 1. Offline Stability (Anti-Macet)
- **Local Model Weights**: Downloaded all AI brain files (`tiny_face_detector`, `landmark_68`) to a local `/weights` folder.
- **Local Library**: Replaced CDN link with local `face-api.min.js`.
- **Result**: Game loads instantly, no more "Sedang memuat AI..." stuck issues.

### 2. Full Torture Suite Restored
We brought back the chaotic fun with refined visuals:

| Effect | Description | Visuals |
| :--- | :--- | :--- |
| **Penyok (Warp)** | Distorts face features randomly. | Big Eyes, Tiny Mouth, Twisted Face, Fat Cheeks. |
| **Tonjok (Punch)** | Impact effect. | "BUGH!" Text overlay + Purple Bruise (Lebam). |
| **Tampar (Slap)** | Anime-style slap animation. | Moving Hand Animation -> Red Handprint on cheek. |
| **Tahi (Poop)** | Classic humiliation. | Realistic Poop emoji splat on forehead. |
| **Makeup** | Random embarrassment. | Menor Lipstick, Snot (Ingus), Drool (Iler), Pimples. |

### 3. Debugging & Polish
- Implemented and then removed a global error logger (`window.onerror`) to catch silent crashes.
- Fixed logic errors (duplicate variables) that were preventing the game from starting.

## 📸 Screenshots
*(Embed screenshots of the new Punch and Warp effects here if available)*

## Next Steps
- Test on mobile devices (performance check for Warp effect).
- Add sound effects (SFX) for Punch and Slap.
