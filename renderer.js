const thumbnailGrid = document.getElementById('thumbnail-grid');
const mainImage = document.getElementById('main-image');
const imageUrlText = document.getElementById('image-url');
const loader = document.getElementById('loader');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

let images = [];
let currentIndex = 0;
let currentZoom = 1;

// Auth Elements
const loginView = document.getElementById('login-view');
const mainAppView = document.getElementById('main-app-view');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name-display');
const userAvatar = document.getElementById('user-avatar');
const togglePassword = document.getElementById('toggle-password');
const loginPassword = document.getElementById('login-password');

// Cryptographic helper to securely hash passwords in SHA-256 hex format
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Auth Logic
function checkAuth() {
    const sessionStr = localStorage.getItem('premium_gallery_session');
    if (sessionStr) {
        const session = JSON.parse(sessionStr);
        userNameDisplay.textContent = session.name;
        userAvatar.textContent = session.name.charAt(0).toUpperCase();

        loginView.style.display = 'none';
        mainAppView.style.display = 'flex';

        // Load images only if logged in and not loaded yet
        if (images.length === 0) fetchImages();
    } else {
        loginView.style.display = 'flex';
        mainAppView.style.display = 'none';

        // Clear out old images on logout
        thumbnailGrid.innerHTML = '';
        images = [];

        // Securely reset and clear the login form inputs
        if (loginForm) loginForm.reset();
        if (loginPassword) loginPassword.type = 'password';
        if (togglePassword) togglePassword.textContent = '👁️';
    }
}

if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        if (loginPassword.type === 'password') {
            loginPassword.type = 'text';
            togglePassword.textContent = '🙈';
        } else {
            loginPassword.type = 'password';
            togglePassword.textContent = '👁️';
        }
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('login-name').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();

    // Hash password securely
    const hashedPassword = await hashPassword(passwordInput);

    // Retrieve existing local account
    const existingAccountStr = localStorage.getItem('premium_gallery_account');

    if (existingAccountStr) {
        const account = JSON.parse(existingAccountStr);
        // Verify credentials case-insensitively and with trimmed values to prevent casing/whitespace issues
        if (account.name.trim().toLowerCase() === nameInput.toLowerCase() && account.passwordHash === hashedPassword) {
            // Correct credentials -> Start session using the original casing of the registered name
            localStorage.setItem('premium_gallery_session', JSON.stringify({ name: account.name }));
            alert(`Welcome back, ${account.name}!\n\nYou currently have 1 GB of local storage available for your personal data and credentials.`);
            checkAuth();
        } else {
            alert("Authentication Failed! Incorrect username or password.");
        }
    } else {
        // First-time login -> Register the account locally with secure hash
        const newAccount = { name: nameInput, passwordHash: hashedPassword };
        localStorage.setItem('premium_gallery_account', JSON.stringify(newAccount));
        localStorage.setItem('premium_gallery_session', JSON.stringify({ name: nameInput }));

        alert(`Welcome ${nameInput}!\n\nYour secure local workspace has been successfully created.\nYou currently have 1 GB of local storage available for your personal data and credentials.`);
        checkAuth();
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('premium_gallery_session');
    checkAuth();
});

const resetWorkspaceBtn = document.getElementById('reset-workspace');
if (resetWorkspaceBtn) {
    resetWorkspaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm("Are you sure you want to reset your local workspace?\n\nThis will permanently delete your stored username and password on this computer, allowing you to create a fresh one.")) {
            localStorage.clear();
            alert("Workspace reset successfully! You can now register with a new name and password.");
            checkAuth();
        }
    });
}

let currentCategory = 'random';
const catBtns = document.querySelectorAll('.cat-btn');

catBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        catBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.dataset.cat;
        fetchImages(); // Refetch the 10 images
    });
});

// Local Image Upload Logic
const localUploadBtn = document.getElementById('local-upload-btn');
const localFileInput = document.getElementById('local-file-input');

if (localUploadBtn && localFileInput) {
    localUploadBtn.addEventListener('click', () => {
        localFileInput.click();
    });

    localFileInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        
        const s3 = getS3Client();
        const s3Config = getS3Config();
        if (!s3 || !s3Config) {
            alert("AWS S3 is not configured yet. Opening S3 configuration modal now...");
            openS3Modal();
            return;
        }
        
        const originalText = localUploadBtn.textContent;
        localUploadBtn.textContent = 'Uploading to S3...';
        localUploadBtn.disabled = true;
        
        try {
            const { PutObjectCommand } = require('@aws-sdk/client-s3');
            
            // Read file array buffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Create unique S3 object key inside 'uploads/' directory
            const uniqueId = Math.floor(Math.random() * 1000000);
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const s3Key = `uploads/gallery_${Date.now()}_${uniqueId}_${sanitizedName}`;
            
            const putCommand = new PutObjectCommand({
                Bucket: s3Config.bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: file.type || 'image/jpeg'
            });
            
            await s3.send(putCommand);
            
            alert(`Success! "${file.name}" uploaded successfully to S3.\n\nFile key: ${s3Key}`);
            
            // Automatically switch category filter to S3 uploads to show the new file
            const s3FilterBtn = Array.from(catBtns).find(btn => btn.dataset.cat === 's3');
            if (s3FilterBtn) {
                catBtns.forEach(b => b.classList.remove('active'));
                s3FilterBtn.classList.add('active');
                currentCategory = 's3';
                fetchImages();
            }
            
        } catch (err) {
            console.error("AWS S3 Direct Upload error:", err);
            if (err.name === 'NoSuchBucket' || err.message.toLowerCase().includes('bucket does not exist')) {
                alert(`S3 Upload failed: The specified bucket "${s3Config.bucketName}" does not exist in the configured region.\n\nOpening S3 settings now so you can check and update your bucket name.`);
                openS3Modal();
            } else {
                alert(`S3 Upload failed: ${err.message}\n\nPlease check S3 Configuration settings and permissions.`);
            }
        } finally {
            localUploadBtn.textContent = originalText;
            localUploadBtn.disabled = false;
            localFileInput.value = '';
        }
    });
}

function buildUrl() {
    // Pick a random valid image ID (Picsum has IDs typically ranging from 1 to 1000)
    // We use a safe range to minimize 404s while giving distinct images
    const imgId = Math.floor(Math.random() * 300) + 1;

    if (currentCategory === 'specific') {
        return `https://picsum.photos/id/${imgId}/600/600`;
    }

    let url = `https://picsum.photos/id/${imgId}/800/600`;

    if (currentCategory === 'grayscale') {
        url += '?grayscale';
    } else if (currentCategory === 'blur') {
        url += '?blur=5';
    }

    return url;
}

async function fetchSingleImage() {
    let retries = 3;
    while (retries > 0) {
        const url = buildUrl();
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const blob = await res.blob();
                return {
                    url: url, // Show the unique URL with the ID
                    objectURL: URL.createObjectURL(blob)
                };
            }
        } catch (e) {
            console.error("Fetch attempt failed:", e);
        }
        retries--;
    }
    return null; // Return null if all 3 attempts fail
}

async function fetchImages() {
    thumbnailGrid.innerHTML = '';
    loader.style.display = 'block';
    images = [];

    try {
        if (currentCategory === 's3') {
            await fetchS3Images();
            return;
        }

        const fetchPromises = [];
        // Fetch 10 independent images
        for (let i = 0; i < 10; i++) {
            fetchPromises.push(fetchSingleImage());
        }

        const results = await Promise.all(fetchPromises);

        // Filter out any images that failed all retries (e.g. persistent 404s)
        images = results.filter(img => img !== null);

        loader.style.display = 'none';

        images.forEach((imgData, index) => {
            const thumb = document.createElement('img');
            thumb.className = 'thumbnail';
            thumb.src = imgData.objectURL;
            thumb.dataset.index = index;

            thumb.addEventListener('click', () => {
                selectImage(index);
            });

            thumbnailGrid.appendChild(thumb);
        });

        // Auto-select the first image once loaded
        if (images.length > 0) {
            selectImage(0);

            // Check if auto-mirroring is enabled and trigger in the background
            const s3Config = getS3Config();
            if (s3Config && s3Config.autoMirror) {
                mirrorImagesToS3(images);
            }
        }

    } catch (error) {
        console.error(error);
        loader.textContent = 'ERROR FETCHING';
        imageUrlText.textContent = 'Error fetching images. Please restart.';
    }
}

function selectImage(index) {
    if (index < 0 || index >= images.length) return;

    currentIndex = index;
    currentZoom = 1; // Reset zoom on image change
    if (mainImage) mainImage.style.transform = `scale(${currentZoom})`;

    const selectedImg = images[currentIndex];

    // Fade out main image, change src, fade back in
    mainImage.style.opacity = 0;

    setTimeout(() => {
        mainImage.src = selectedImg.objectURL;
        mainImage.onload = () => {
            mainImage.style.opacity = 1;
        };
    }, 150); // slight delay makes transition smoother

    // Update URL text below image
    imageUrlText.textContent = selectedImg.url;

    // Highlight the active thumbnail
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        if (i === currentIndex) {
            thumb.classList.add('active');
            // scroll into view smoothly if needed
            thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            thumb.classList.remove('active');
        }
    });

    // Update manual Save to S3 button status
    const saveToS3Btn = document.getElementById('save-to-s3-btn');
    if (saveToS3Btn) {
        if (currentCategory === 's3') {
            saveToS3Btn.textContent = '✓ Saved in S3';
            saveToS3Btn.disabled = true;
            saveToS3Btn.style.background = '#000000ff'; // Green for saved
            saveToS3Btn.style.borderColor = '#000000ff';
        } else {
            saveToS3Btn.textContent = 'Save to S3';
            saveToS3Btn.disabled = false;
            saveToS3Btn.style.background = '#040404ff'; // Blue for unsaved
            saveToS3Btn.style.borderColor = '#0a0a0aff';
        }
    }
}

// Button controls
prevBtn.addEventListener('click', () => {
    if (images.length === 0) return;
    // Loop backwards
    selectImage((currentIndex - 1 + images.length) % images.length);
});

nextBtn.addEventListener('click', () => {
    if (images.length === 0) return;
    // Loop forwards
    selectImage((currentIndex + 1) % images.length);
});

// Zoom and Enlarge controls
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const enlargeBtn = document.getElementById('enlarge');
const downloadBtn = document.getElementById('download');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxBackBtn = document.getElementById('lightbox-back');

zoomInBtn.addEventListener('click', () => {
    currentZoom += 0.2;
    mainImage.style.transform = `scale(${currentZoom})`;
});

zoomOutBtn.addEventListener('click', () => {
    currentZoom = Math.max(0.2, currentZoom - 0.2);
    mainImage.style.transform = `scale(${currentZoom})`;
});

enlargeBtn.addEventListener('click', () => {
    if (images.length === 0) return;
    lightboxImg.src = images[currentIndex].objectURL;
    lightbox.style.display = 'flex'; // Show black backdrop
});

lightboxBackBtn.addEventListener('click', () => {
    lightbox.style.display = 'none'; // Go backward
});

const fs = require('fs');
const path = require('path');
const os = require('os');

downloadBtn.addEventListener('click', async () => {
    if (images.length === 0 || currentIndex >= images.length) return;
    const selectedImg = images[currentIndex];
    const originalText = downloadBtn.textContent;

    try {
        downloadBtn.textContent = 'Downloading...';
        downloadBtn.disabled = true;

        // Fetch the raw image data from the actual URL
        const response = await fetch(selectedImg.url);
        if (!response.ok) throw new Error('Network error during download');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save automatically to the user's Downloads folder
        const fileName = `premium_gallery_${Math.floor(Math.random() * 100000)}.jpg`;
        const filePath = path.join(os.homedir(), 'Downloads', fileName);

        fs.writeFileSync(filePath, buffer);

        downloadBtn.textContent = 'Saved to Downloads!';
        setTimeout(() => {
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }, 3000);

    } catch (err) {
        console.error("Download failed:", err);
        downloadBtn.textContent = 'Download Error!';
        setTimeout(() => {
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }, 3000);
    }
});

// AWS S3 Configuration Management Helpers
function getS3Config() {
    const configStr = localStorage.getItem('premium_gallery_s3_config');
    return configStr ? JSON.parse(configStr) : null;
}

function saveS3Config(accessKeyId, secretAccessKey, bucketName, region, autoMirror) {
    const config = {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim(),
        bucketName: bucketName.trim(),
        region: region.trim() || 'us-east-1',
        autoMirror: !!autoMirror
    };
    localStorage.setItem('premium_gallery_s3_config', JSON.stringify(config));
}

// Global S3 client instance caching to avoid duplicate configuration calls
let cachedS3Client = null;

function getS3Client(forceRefresh = false) {
    if (cachedS3Client && !forceRefresh) {
        return cachedS3Client;
    }

    const s3Config = getS3Config();
    if (!s3Config) return null;

    try {
        const { S3Client } = require('@aws-sdk/client-s3');
        cachedS3Client = new S3Client({
            region: s3Config.region,
            credentials: {
                accessKeyId: s3Config.accessKeyId,
                secretAccessKey: s3Config.secretAccessKey
            }
        });
        return cachedS3Client;
    } catch (err) {
        console.error("AWS S3 Client instantiation error:", err);
        return null;
    }
}

// AWS S3 Modal Control Logic
const s3Modal = document.getElementById('s3-modal');
const s3ModalClose = document.getElementById('s3-modal-close');
const s3ConfigForm = document.getElementById('s3-config-form');

const s3AccessKeyInput = document.getElementById('s3-access-key');
const s3SecretKeyInput = document.getElementById('s3-secret-key');
const s3BucketNameInput = document.getElementById('s3-bucket-name');
const s3RegionInput = document.getElementById('s3-region');
const s3AutoMirrorInput = document.getElementById('s3-auto-mirror');

function openS3Modal() {
    const config = getS3Config();
    if (config) {
        s3AccessKeyInput.value = config.accessKeyId;
        s3SecretKeyInput.value = config.secretAccessKey;
        s3BucketNameInput.value = config.bucketName;
        s3RegionInput.value = config.region;
        if (s3AutoMirrorInput) s3AutoMirrorInput.checked = !!config.autoMirror;
    }
    if (s3Modal) s3Modal.style.display = 'flex';
}

function closeS3Modal() {
    if (s3Modal) s3Modal.style.display = 'none';
}

if (s3ModalClose) {
    s3ModalClose.addEventListener('click', closeS3Modal);
}

if (s3ConfigForm) {
    s3ConfigForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveS3Config(
            s3AccessKeyInput.value,
            s3SecretKeyInput.value,
            s3BucketNameInput.value,
            s3RegionInput.value,
            s3AutoMirrorInput ? s3AutoMirrorInput.checked : false
        );

        // Recreate the cached S3 Client with new settings
        getS3Client(true);

        alert("S3 Cloud Configuration Saved Successfully!");
        closeS3Modal();

        // If current view is S3, fetch new images immediately
        if (currentCategory === 's3') {
            fetchImages();
        }
    });
}

// AWS S3 Image Listing Logic
async function fetchS3Images() {
    const s3 = getS3Client();
    const s3Config = getS3Config();

    if (!s3 || !s3Config) {
        loader.style.display = 'none';
        thumbnailGrid.innerHTML = `
            <div style="grid-column: span 2; padding: 30px 10px; text-align: center; font-family: 'Inter', sans-serif;">
                <p style="color: #ff5252; font-size: 13px; font-weight: 600; margin-bottom: 12px;">S3 is not configured yet.</p>
                <button onclick="openS3Modal()" class="icon-btn" style="background: #ffffff; color: #1a1a1a; padding: 6px 12px; font-size: 12px;">Configure S3 Now</button>
            </div>
        `;
        imageUrlText.textContent = 'AWS S3 Cloud not configured.';
        openS3Modal();
        return;
    }

    try {
        const { ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

        const listCommand = new ListObjectsV2Command({
            Bucket: s3Config.bucketName
        });

        const response = await s3.send(listCommand);
        const contents = response.Contents || [];

        // Image extensions filter
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
        const imageObjects = contents.filter(item => {
            const lowerKey = item.Key.toLowerCase();
            return imageExtensions.some(ext => lowerKey.endsWith(ext));
        });

        if (imageObjects.length === 0) {
            loader.style.display = 'none';
            thumbnailGrid.innerHTML = `
                <p style="color: #888888; font-size: 12px; text-align: center; grid-column: span 2; margin-top: 30px; line-height: 1.5;">
                    No images found in bucket "${s3Config.bucketName}".<br><br>
                    Mirror normal gallery images to S3 using the "Save to S3" button!
                </p>
            `;
            imageUrlText.textContent = 'S3 Bucket is empty.';
            return;
        }

        // Sort newest first
        imageObjects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

        // Fetch files and build object URLs (works perfectly for both private & public buckets!)
        // Fetch max 20 images to maintain blazing performance
        const fetchPromises = imageObjects.slice(0, 20).map(async (obj) => {
            try {
                const getObjCommand = new GetObjectCommand({
                    Bucket: s3Config.bucketName,
                    Key: obj.Key
                });
                const s3Response = await s3.send(getObjCommand);
                const arrayBuffer = await s3Response.Body.transformToByteArray();
                const blob = new Blob([arrayBuffer]);
                const objectURL = URL.createObjectURL(blob);

                return {
                    url: `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${obj.Key}`,
                    objectURL: objectURL,
                    key: obj.Key
                };
            } catch (err) {
                console.error(`Error loading S3 object ${obj.Key}:`, err);
                return null;
            }
        });

        const fetchedS3Images = await Promise.all(fetchPromises);
        images = fetchedS3Images.filter(img => img !== null);

        loader.style.display = 'none';

        if (images.length === 0) {
            thumbnailGrid.innerHTML = '<p style="color: #ff5252; font-size: 13px; text-align: center; grid-column: span 2; margin-top: 20px;">Failed to load S3 images. Check bucket access policies.</p>';
            imageUrlText.textContent = 'Error downloading S3 objects.';
            return;
        }

        images.forEach((imgData, index) => {
            const thumb = document.createElement('img');
            thumb.className = 'thumbnail';
            thumb.src = imgData.objectURL;
            thumb.dataset.index = index;

            thumb.addEventListener('click', () => {
                selectImage(index);
            });

            thumbnailGrid.appendChild(thumb);
        });

        if (images.length > 0) {
            selectImage(0);
        }

    } catch (err) {
        console.error("AWS S3 Fetch error:", err);
        loader.style.display = 'none';
        thumbnailGrid.innerHTML = `
            <div style="grid-column: span 2; padding: 20px 5px; text-align: center; font-family: 'Inter', sans-serif;">
                <p style="color: #ff5252; font-size: 12px; font-weight: 600; line-height: 1.5; margin-bottom: 12px;">S3 Fetch Failed</p>
                <p style="color: #666; font-size: 11px; margin-bottom: 15px; max-height: 80px; overflow-y: auto;">${err.message}</p>
                <button onclick="openS3Modal()" class="icon-btn" style="font-size: 11px; padding: 4px 8px;">Edit Settings</button>
            </div>
        `;
        imageUrlText.textContent = 'S3 API communication error.';
    }
}


// AWS S3 Auto Mirror Background Fetch Syncing
async function mirrorImagesToS3(imagesArray) {
    const s3 = getS3Client();
    const s3Config = getS3Config();
    if (!s3 || !s3Config) return;

    console.log("S3 Auto Mirror: Syncing fetched API images in the background...");

    try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');

        for (const img of imagesArray) {
            try {
                // Extract Picsum ID to avoid duplicating identical images in bucket
                const idMatch = img.url.match(/\/id\/(\d+)/);
                const imgId = idMatch ? idMatch[1] : `rand_${Math.floor(Math.random() * 100000)}`;
                const s3Key = `picsum/picsum_${imgId}.jpg`;

                // Retrieve binary data from local memory URL
                const res = await fetch(img.objectURL);
                const blob = await res.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                const putCommand = new PutObjectCommand({
                    Bucket: s3Config.bucketName,
                    Key: s3Key,
                    Body: buffer,
                    ContentType: 'image/jpeg'
                });

                await s3.send(putCommand);
                console.log(`✓ S3 Auto Mirror: Synced picsum_${imgId}.jpg to cloud!`);
            } catch (err) {
                console.error(`S3 Auto Mirror upload failed for image:`, err);
            }
        }
    } catch (err) {
        console.error("AWS S3 Auto Mirror sync error:", err);
    }
}

// Manual S3 Image Save Button Logic
const saveToS3Btn = document.getElementById('save-to-s3-btn');

if (saveToS3Btn) {
    saveToS3Btn.addEventListener('click', async () => {
        if (images.length === 0 || currentIndex >= images.length) return;
        const currentImg = images[currentIndex];

        const s3 = getS3Client();
        const s3Config = getS3Config();

        if (!s3 || !s3Config) {
            alert("AWS S3 is not configured yet. Opening settings panel now...");
            openS3Modal();
            return;
        }

        if (currentCategory === 's3') {
            alert("This image is already hosted on your AWS S3 bucket.");
            return;
        }

        const originalText = saveToS3Btn.textContent;
        saveToS3Btn.textContent = 'Mirroring...';
        saveToS3Btn.disabled = true;

        try {
            const { PutObjectCommand } = require('@aws-sdk/client-s3');

            // Download binary blob from local in-memory URL
            const res = await fetch(currentImg.objectURL);
            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Generate clean key with Picsum ID or local filename
            const idMatch = currentImg.url.match(/\/id\/(\d+)/);
            let s3Key;
            if (idMatch) {
                const imgId = idMatch[1];
                s3Key = `saved/picsum_${imgId}_${Date.now()}.jpg`;
            } else {
                // Extract local filename, sanitize, and prepend local_
                const fileName = currentImg.url.split(/[/\\]/).pop().replace(/[^a-zA-Z0-9.]/g, '_');
                s3Key = `saved/local_${Date.now()}_${fileName}`;
            }

            const putCommand = new PutObjectCommand({
                Bucket: s3Config.bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: blob.type || 'image/jpeg'
            });

            await s3.send(putCommand);

            alert(`Success! Image mirrored to your cloud bucket successfully.\n\nS3 Key: ${s3Key}`);

            // Switch button state to success
            saveToS3Btn.textContent = '✓ Saved in S3';
            saveToS3Btn.disabled = true;
            saveToS3Btn.style.background = '#10b981';
            saveToS3Btn.style.borderColor = '#10b981';

        } catch (err) {
            console.error("AWS S3 Manual Save failed:", err);
            if (err.name === 'NoSuchBucket' || err.message.toLowerCase().includes('bucket does not exist')) {
                alert(`S3 Save failed: The specified bucket "${s3Config.bucketName}" does not exist in the configured region.\n\nOpening S3 settings now so you can check and update your bucket name.`);
                openS3Modal();
            } else {
                alert(`S3 Save failed: ${err.message}\n\nPlease check S3 Configuration settings and permissions.`);
            }
            saveToS3Btn.textContent = originalText;
            saveToS3Btn.disabled = false;
        }
    });
}

// Kick off auth check
checkAuth();
