# Dugout Pulse ⚾

A fast, lean, single-player baseball and softball scorekeeping app built for parents and players to score live games directly from the stands.

- **100% Offline & Private:** All data lives locally on your device in browser storage. No accounts, no backend servers, no cloud tracking.
- **Fast One-Thumb Scoring:** Large 56px+ tap targets, haptic feedback, instant Undo, and smart bench controls.
- **Automated Season Statistics:** Batting (AVG, OBP, SLG, OPS, HR, RBI, R, BB, SO, SB, CS, PA), Pitching (IP, ERA, WHIP, K, H, BB, ER), and Fielding (FPCT, PO, A, E, DP, PB, CS).
- **RFC 4180 CSV Export & Full JSON Backup:** One-click CSV export with UTF-8 BOM for Excel / Google Sheets and full JSON backup/restore.

---

## 💻 Local Development (Desktop Browser)

Run and test the web app directly in your desktop browser:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📱 Building the Local Android APK (Windows)

The app is built as a lightweight web app wrapped with Capacitor into a standalone Android APK (under ~5–8 MB).

### Prerequisites
1. **Node.js** (v18+) & **npm**
2. **JDK 17** (e.g., Eclipse Adoptium Temurin 17 or Android Studio JBR)
3. **Android Studio** with the Android SDK installed (`%LOCALAPPDATA%\Android\Sdk`)

### Build Steps

1. **Install dependencies:**
   ```powershell
   npm install
   npm install -D @capacitor/cli @capacitor/core @capacitor/android
   ```

2. **Add the Android platform (first time only):**
   ```powershell
   npm run build
   npx cap add android
   ```

3. **Run the automated build script:**
   ```powershell
   .\build-apk.ps1
   ```
   Or for a release build:
   ```powershell
   .\build-apk.ps1 -Release
   ```

4. **Find your finished APK:**
   The output APK will be saved directly in the `apk-output\` folder with a timestamp (e.g. `apk-output\baseball-hub-debug-2026-09-30_10-15.apk`).

5. **Install on your Android phone:**
   - Transfer the `.apk` to your phone via Bluetooth, Google Drive, WhatsApp, or email.
   - Tap the file on your phone and choose **Install** (allow installs from unknown sources if prompted).
   - Newer builds will install directly over previous versions without losing your saved season data.

---

## 📊 Exact Scoring Formulas

### Batting
- **Hits (H):** `1B + 2B + 3B + HR`
- **At-Bats (AB):** `H + K + OUT` (Walks, HBP, and Sac Flies are not at-bats)
- **Plate Appearances (PA):** `AB + BB + HBP + SF`
- **Total Bases (TB):** `1B + 2×2B + 3×3B + 4×HR`
- **AVG:** `H / AB`
- **OBP:** `(H + BB + HBP) / PA`
- **SLG:** `TB / AB`
- **OPS:** `OBP + SLG`

### Pitching
- **Outs:** `Strikeouts (Pitcher) + Out recorded`
- **IP:** `floor(outs / 3) . (outs % 3)` (e.g. 7 outs = `2.1`)
- **ERA:** `Earned Runs × InningsPerGame / (outs / 3)` (Default: 7 innings)
- **WHIP:** `(Hits Allowed + Walks Allowed) / (outs / 3)`

### Fielding
- **Chances:** `Putouts + Assists + Errors`
- **FPCT:** `(Putouts + Assists) / Chances`
