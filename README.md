# Premium Desktop Image Viewer

A native Windows desktop gallery application crafted with a premium, high-contrast minimalist black-and-white theme. Built using **Electron**, **Node.js**, and the **Picsum API**, the application features a robust local-first cryptographic authentication system, fluent animations, dynamic image controls, and concurrent asynchronous image loading.

---

## Key Features

### Secure Local-First Workspace
* **SHA-256 Password Cryptography:** All passwords are mathematically hashed using browser-native `crypto.subtle` (SHA-256). The raw plain-text password never touches the hard drive or the network.
* **100% Local Storage:** User data is saved directly on your PC inside your AppData directory. There is absolutely no external cloud database.
* **Volatile Session Control:** Logging out cleanly wipes your browser session token and auto-clears the login form inputs to prevent autocomplete leakage.
* **One-Click Recovery:** Includes a secure "Reset Workspace" utility to purge outdated database files and allow quick registration.

### Visual & Functional Excellence
* **High-Contrast Dark Mode Sidebar:** Features a sleek dark aside menu hosting custom category filters, user profile details, and a dynamic letter-avatar generator.
* **Smart Concurrency Streaming:** Spawns concurrent image loading requests. Automatically handles missing photo IDs using smart background retries to ensure a beautiful 10-photo grid every time.
* **Interactive Image Workspace:** Includes continuous Previous/Next navigation, fluid Zoom In (+) & Zoom Out (-) features, and a distraction-free blackout "Enlarge" mode with dynamic retro return navigation.
* **Direct OS Integration:** Download high-resolution photographs directly to your system's `Downloads` folder utilizing native Node.js `fs` (File System) and `os` libraries.

---

## How it Works (Under the Hood)

```
[Launcher] ──> [Decrypt Session (localStorage)] ──> [Login Screen (SHA-256 Check)]
                                                            │
    ┌───────────────────────────────────────────────────────┘
    ▼
[Load Gallery Workspace] ──> [Picsum Concurrent Pull] ──> [Native Filesystem Download]
```

* **Storage Path:** `%appdata%\premium-image-viewer\Local Storage\`
* **Authentication Verification:** `account.name.trim().toLowerCase() === nameInput.toLowerCase() && account.passwordHash === hashedPassword`

---

## Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation & Local Run
1. Clone the repository:
   ```bash
   git clone https://github.com/Jagadesh-1811/image-viewer-desktop-app.git
   cd image-viewer-desktop-app
   ```
2. Install the necessary development dependencies:
   ```bash
   npm install
   ```
3. Boot up the desktop application:
   ```bash
   npm start
   ```

---

## Compiling Standalone Executables (.exe)

To bundle the application into a standalone folder that runs on any 64-bit Windows computer (without requiring Node.js installed):

1. Compile the app using Electron Packager:
   ```bash
   npx electron-packager . "Premium Image Viewer" --platform=win32 --arch=x64 --out=dist --overwrite
   ```
2. Your pre-built distribution will write to:
   `dist/Premium Image Viewer-win32-x64/`
3. **Distribution Warning:** Because the executable relies on direct DLL files (`ffmpeg.dll`, `vulkan-1.dll`, etc.), you **must** compress the entire `Premium Image Viewer-win32-x64` folder into a `.zip` archive before uploading it to GitHub Releases or sharing it with others.

---

## License
This project is open-source and available under the [MIT License](LICENSE).
