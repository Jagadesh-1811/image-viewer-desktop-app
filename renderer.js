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
    const name = document.getElementById('login-name').value;
    const password = document.getElementById('login-password').value;
    
    // Hash password securely
    const hashedPassword = await hashPassword(password);
    
    // Retrieve existing local account
    const existingAccountStr = localStorage.getItem('premium_gallery_account');
    
    if (existingAccountStr) {
        const account = JSON.parse(existingAccountStr);
        // Verify credentials against the secure local hash
        if (account.name === name && account.passwordHash === hashedPassword) {
            // Correct credentials -> Start session
            localStorage.setItem('premium_gallery_session', JSON.stringify({ name }));
            alert(`Welcome back, ${name}!\n\nYou currently have 1 GB of local storage available for your personal data and credentials.`);
            checkAuth();
        } else {
            alert("Authentication Failed! Incorrect username or password.");
        }
    } else {
        // First-time login -> Register the account locally with secure hash
        const newAccount = { name, passwordHash: hashedPassword };
        localStorage.setItem('premium_gallery_account', JSON.stringify(newAccount));
        localStorage.setItem('premium_gallery_session', JSON.stringify({ name }));
        
        alert(`Welcome ${name}!\n\nYour secure local workspace has been successfully created.\nYou currently have 1 GB of local storage available for your personal data and credentials.`);
        checkAuth();
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('premium_gallery_session');
    checkAuth();
});

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

// Kick off auth check
checkAuth();
