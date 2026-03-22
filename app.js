// Deteksi apakah bisa di-install
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Update UI notify the user they can add to home screen
    showInstallPromotion();
});

function showInstallPromotion() {
    // Tampilkan banner atau button "Install App"
    const installBanner = document.createElement('div');
    installBanner.innerHTML = `
        <div style="position:fixed;bottom:80px;left:20px;right:20px;background:white;padding:15px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.2);display:flex;align-items:center;gap:15px;z-index:1000;">
            <img src="./icons/icon-72x72.png" width="40" height="40" style="border-radius:8px;">
            <div style="flex:1;">
                <div style="font-weight:600;">Install Inventaris App</div>
                <div style="font-size:0.8rem;color:#6b7280;">Akses lebih cepat dari home screen</div>
            </div>
            <button onclick="installApp()" style="background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:600;">Install</button>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#9ca3af;"><i class="fas fa-times"></i></button>
        </div>
    `;
    document.body.appendChild(installBanner);
}

async function installApp() {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // Clear the deferredPrompt variable
    deferredPrompt = null;
}

// Track successful installation
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    deferredPrompt = null;
    // Hide install promotion
    document.querySelector('.install-banner')?.remove();
});