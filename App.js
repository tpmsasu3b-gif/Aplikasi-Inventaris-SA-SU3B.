/**
 * STOCK INVENTORY PRO - MAIN APPLICATION
 * Version: 2.0.0
 * Architecture: Modular ES6+ with Class-based structure
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const CONFIG = {
    APP_NAME: 'Stock Inventory Pro',
    VERSION: '2.0.0',
    STORAGE_KEY: 'sip_inventory_data',
    ACTIVITY_KEY: 'sip_activity_log',
    SETTINGS_KEY: 'sip_settings',
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 5000,
    SYNC_INTERVAL: 30000, // 30 seconds
    LOW_STOCK_THRESHOLD: 5
};

const CONSTANTS = {
    STOCK_STATUS: {
        AVAILABLE: { class: 'success', label: 'Tersedia', color: '#10b981' },
        LOW: { class: 'warning', label: 'Rendah', color: '#f59e0b' },
        OUT: { class: 'danger', label: 'Habis', color: '#ef4444' }
    },
    
    ACTIVITY_TYPES: {
        IN: { icon: 'arrow-down', label: 'Stok Masuk', color: 'success' },
        OUT: { icon: 'arrow-up', label: 'Stok Keluar', color: 'danger' },
        ADJUST: { icon: 'sliders-h', label: 'Penyesuaian', color: 'info' },
        TRANSFER: { icon: 'exchange-alt', label: 'Transfer', color: 'warning' },
        CREATE: { icon: 'plus', label: 'Produk Baru', color: 'primary' },
        EDIT: { icon: 'edit', label: 'Edit Produk', color: 'info' },
        DELETE: { icon: 'trash', label: 'Hapus Produk', color: 'danger' }
    },

    CATEGORIES: [
        { id: 'elektronik', name: 'Elektronik', icon: '🔌' },
        { id: 'komputer', name: 'Komputer', icon: '💻' },
        { id: 'aksesoris', name: 'Aksesoris', icon: '🖱️' },
        { id: 'jaringan', name: 'Jaringan', icon: '📡' },
        { id: 'storage', name: 'Storage', icon: '💾' },
        { id: 'lainnya', name: 'Lainnya', icon: '📦' }
    ],

    UNITS: ['Unit', 'Pcs', 'Box', 'Set', 'Kg', 'Meter', 'Liter', 'Pack']
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const Utils = {
    /**
     * Generate unique ID
     */
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Format number with thousand separator
     */
    formatNumber: (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    /**
     * Format currency
     */
    formatCurrency: (amount, currency = 'IDR') => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    /**
     * Format date relative (e.g., "5 menit yang lalu")
     */
    formatRelativeTime: (date) => {
        const now = new Date();
        const diff = Math.floor((now - new Date(date)) / 1000); // seconds
        
        if (diff < 60) return 'Baru saja';
        if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} jam yang lalu`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} hari yang lalu`;
        
        return new Date(date).toLocaleDateString('id-ID');
    },

    /**
     * Format date to local string
     */
    formatDate: (date) => {
        return new Date(date).toLocaleString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Debounce function
     */
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle: (func, limit) => {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Deep clone object
     */
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),

    /**
     * Validate SKU format
     */
    validateSKU: (sku) => {
        const regex = /^[A-Z]{3}-[A-Z]{3}-\d{3}$/;
        return regex.test(sku);
    },

    /**
     * Generate SKU from product name
     */
    generateSKU: (name, category) => {
        const catCode = category.substring(0, 3).toUpperCase();
        const nameCode = name.substring(0, 3).toUpperCase();
        const random = Math.floor(Math.random() * 900) + 100;
        return `${catCode}-${nameCode}-${random}`;
    },

    /**
     * Export data to CSV
     */
    exportToCSV: (data, filename = 'inventory.csv') => {
        const headers = ['ID', 'Nama', 'SKU', 'Kategori', 'Stok', 'Stok Min', 'Lokasi', 'Terakhir Update'];
        const rows = data.map(item => [
            item.id,
            `"${item.name}"`,
            item.sku,
            item.category,
            item.stock,
            item.minStock,
            `"${item.location || '-'}"`,
            item.lastUpdate
        ]);
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    },

    /**
     * Calculate stock percentage for progress bar
     */
    calculateStockPercent: (stock, minStock) => {
        const optimal = minStock * 3;
        return Math.min((stock / optimal) * 100, 100);
    }
};

// ============================================
// STORAGE MANAGER (LocalStorage Wrapper)
// ============================================

class StorageManager {
    static get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Storage get error for key ${key}:`, error);
            return defaultValue;
        }
    }

    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Storage set error for key ${key}:`, error);
            return false;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Storage remove error for key ${key}:`, error);
            return false;
        }
    }

    static clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
}

// ============================================
// DATA STORE (State Management)
// ============================================

class DataStore {
    constructor() {
        this.inventory = this.loadInventory();
        this.activities = this.loadActivities();
        this.settings = this.loadSettings();
        this.listeners = [];
    }

    // Inventory Methods
    loadInventory() {
        const saved = StorageManager.get(CONFIG.STORAGE_KEY);
        if (saved && saved.length > 0) return saved;
        
        // Default sample data
        return [
            {
                id: Utils.generateId(),
                name: 'Laptop Dell XPS 13',
                sku: 'KOM-DEL-001',
                category: 'komputer',
                stock: 24,
                minStock: 5,
                price: 15000000,
                location: 'Gudang A - Rak 1',
                description: 'Laptop premium dengan Intel Core i7',
                image: '💻',
                createdAt: new Date().toISOString(),
                lastUpdate: new Date().toISOString()
            },
            {
                id: Utils.generateId(),
                name: 'Mouse Logitech MX Master 3',
                sku: 'AKS-LOG-002',
                category: 'aksesoris',
                stock: 3,
                minStock: 10,
                price: 1200000,
                location: 'Gudang A - Rak 2',
                description: 'Mouse wireless ergonomis',
                image: '🖱️',
                createdAt: new Date().toISOString(),
                lastUpdate: new Date().toISOString()
            },
            {
                id: Utils.generateId(),
                name: 'Keyboard Mechanical Keychron K2',
                sku: 'AKS-KEY-003',
                category: 'aksesoris',
                stock: 45,
                minStock: 10,
                price: 1800000,
                location: 'Gudang A - Rak 2',
                description: 'Keyboard mechanical wireless',
                image: '⌨️',
                createdAt: new Date().toISOString(),
                lastUpdate: new Date().toISOString()
            },
            {
                id: Utils.generateId(),
                name: 'Monitor LG 27" 4K UltraFine',
                sku: 'ELG-LG-004',
                category: 'elektronik',
                stock: 0,
                minStock: 3,
                price: 8500000,
                location: 'Gudang B - Rak 1',
                description: 'Monitor 4K IPS profesional',
                image: '🖥️',
                createdAt: new Date().toISOString(),
                lastUpdate: new Date().toISOString()
            },
            {
                id: Utils.generateId(),
                name: 'Router WiFi 6 TP-Link AX6000',
                sku: 'JAR-TPL-005',
                category: 'jaringan',
                stock: 12,
                minStock: 5,
                price: 3200000,
                location: 'Gudang C - Rak 1',
                description: 'Router WiFi 6 high performance',
                image: '📡',
                createdAt: new Date().toISOString(),
                lastUpdate: new Date().toISOString()
            }
        ];
    }

    saveInventory() {
        StorageManager.set(CONFIG.STORAGE_KEY, this.inventory);
        this.notify('inventory');
    }

    addProduct(product) {
        const newProduct = {
            id: Utils.generateId(),
            ...product,
            createdAt: new Date().toISOString(),
            lastUpdate: new Date().toISOString()
        };
        this.inventory.unshift(newProduct);
        this.saveInventory();
        this.logActivity('CREATE', newProduct.name, product.stock);
        return newProduct;
    }

    updateProduct(id, updates) {
        const index = this.inventory.findIndex(p => p.id === id);
        if (index === -1) return null;
        
        const oldStock = this.inventory[index].stock;
        this.inventory[index] = {
            ...this.inventory[index],
            ...updates,
            lastUpdate: new Date().toISOString()
        };
        
        this.saveInventory();
        
        // Log if stock changed
        if (updates.stock !== undefined && updates.stock !== oldStock) {
            const diff = updates.stock - oldStock;
            const type = diff > 0 ? 'IN' : 'OUT';
            this.logActivity(type, this.inventory[index].name, Math.abs(diff));
        } else {
            this.logActivity('EDIT', this.inventory[index].name);
        }
        
        return this.inventory[index];
    }

    deleteProduct(id) {
        const index = this.inventory.findIndex(p => p.id === id);
        if (index === -1) return false;
        
        const name = this.inventory[index].name;
        this.inventory.splice(index, 1);
        this.saveInventory();
        this.logActivity('DELETE', name);
        return true;
    }

    adjustStock(id, quantity, reason = '') {
        const product = this.inventory.find(p => p.id === id);
        if (!product) return null;
        
        const newStock = Math.max(0, product.stock + quantity);
        const actualChange = newStock - product.stock;
        
        if (actualChange === 0) return product;
        
        product.stock = newStock;
        product.lastUpdate = new Date().toISOString();
        this.saveInventory();
        
        const type = actualChange > 0 ? 'IN' : 'OUT';
        this.logActivity(type, product.name, Math.abs(actualChange), reason);
        
        return product;
    }

    getProductById(id) {
        return this.inventory.find(p => p.id === id);
    }

    searchProducts(query) {
        const lowerQuery = query.toLowerCase();
        return this.inventory.filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.sku.toLowerCase().includes(lowerQuery) ||
            p.category.toLowerCase().includes(lowerQuery) ||
            (p.location && p.location.toLowerCase().includes(lowerQuery))
        );
    }

    getLowStockProducts() {
        return this.inventory.filter(p => p.stock > 0 && p.stock <= p.minStock);
    }

    getOutOfStockProducts() {
        return this.inventory.filter(p => p.stock === 0);
    }

    getStats() {
        const total = this.inventory.length;
        const totalStock = this.inventory.reduce((sum, p) => sum + p.stock, 0);
        const inStock = this.inventory.filter(p => p.stock > p.minStock).length;
        const lowStock = this.getLowStockProducts().length;
        const outOfStock = this.getOutOfStockProducts().length;
        const totalValue = this.inventory.reduce((sum, p) => sum + (p.stock * (p.price || 0)), 0);
        
        return { total, totalStock, inStock, lowStock, outOfStock, totalValue };
    }

    // Activity Methods
    loadActivities() {
        return StorageManager.get(CONFIG.ACTIVITY_KEY, []);
    }

    saveActivities() {
        StorageManager.set(CONFIG.ACTIVITY_KEY, this.activities);
    }

    logActivity(type, productName, quantity = null, note = '') {
        const activity = {
            id: Utils.generateId(),
            type,
            productName,
            quantity,
            note,
            timestamp: new Date().toISOString(),
            user: 'Admin'
        };
        
        this.activities.unshift(activity);
        
        // Keep only last 100 activities
        if (this.activities.length > 100) {
            this.activities = this.activities.slice(0, 100);
        }
        
        this.saveActivities();
        this.notify('activities');
    }

    getRecentActivities(limit = 10) {
        return this.activities.slice(0, limit);
    }

    // Settings Methods
    loadSettings() {
        return StorageManager.get(CONFIG.SETTINGS_KEY, {
            lowStockAlert: true,
            autoSync: true,
            currency: 'IDR',
            dateFormat: 'id-ID',
            itemsPerPage: 10
        });
    }

    saveSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        StorageManager.set(CONFIG.SETTINGS_KEY, this.settings);
    }

    // Observer Pattern for Reactivity
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(event) {
        this.listeners.forEach(listener => listener(event, this));
    }
}

// ============================================
// UI CONTROLLER
// ============================================

class UIController {
    constructor(store) {
        this.store = store;
        this.currentPage = 'dashboard';
        this.modals = new Set();
        this.toastContainer = document.getElementById('toastContainer');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderDashboard();
        this.setupRealtimeUpdates();
    }

    bindEvents() {
        // Global search with debounce
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', 
                Utils.debounce((e) => this.handleSearch(e.target.value), CONFIG.DEBOUNCE_DELAY)
            );
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Modal close on outside click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal.id);
            });
        });

        // Mobile menu
        const menuBtn = document.querySelector('.mobile-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => this.toggleSidebar());
        }
    }

    handleKeyboard(e) {
        // ESC to close modals
        if (e.key === 'Escape') {
            this.closeAllModals();
        }
        
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('globalSearch')?.focus();
        }
        
        // Ctrl/Cmd + N for new product
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.openModal('addProductModal');
        }
        
        // Ctrl/Cmd + E for export
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            this.exportData();
        }
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.renderInventoryTable(this.store.inventory);
            return;
        }
        
        const results = this.store.searchProducts(query);
        this.renderInventoryTable(results);
        
        // Update page title temporarily
        const title = document.querySelector('.page-header h2');
        if (title) {
            title.textContent = `Hasil Pencarian: "${query}"`;
        }
    }

    // Navigation
    switchPage(page) {
        this.currentPage = page;
        
        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.textContent.toLowerCase().includes(page)) {
                item.classList.add('active');
            }
        });
        
        // Close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');
        
        // Render appropriate content
        switch(page) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'inventory':
                this.renderInventoryPage();
                break;
            case 'transactions':
                this.renderTransactionsPage();
                break;
            case 'reports':
                this.renderReportsPage();
                break;
            case 'settings':
                this.renderSettingsPage();
                break;
            default:
                this.renderDashboard();
        }
        
        // Update URL without reload
        history.pushState({ page }, '', `#${page}`);
    }

    // Rendering Methods
    renderDashboard() {
        this.updatePageHeader('Dashboard Overview', 'Monitor stok dan aktivitas gudang real-time');
        this.renderStats();
        this.renderInventoryTable(this.store.inventory.slice(0, 5));
        this.renderActivities();
    }

    renderInventoryPage() {
        this.updatePageHeader('Manajemen Inventory', 'Kelola seluruh produk dan stok');
        this.renderInventoryTable(this.store.inventory);
    }

    renderTransactionsPage() {
        this.updatePageHeader('Riwayat Transaksi', 'Lihat semua aktivitas stok masuk dan keluar');
        this.renderActivities(this.store.activities);
    }

    renderReportsPage() {
        this.updatePageHeader('Laporan & Analisis', 'Analisis performa inventory');
        // TODO: Implement charts
        this.showToast('info', 'Coming Soon', 'Fitur laporan akan segera hadir!');
    }

    renderSettingsPage() {
        this.updatePageHeader('Pengaturan', 'Konfigurasi aplikasi dan preferensi');
        // TODO: Implement settings UI
    }

    updatePageHeader(title, subtitle) {
        const header = document.querySelector('.page-header');
        if (!header) return;
        
        header.innerHTML = `
            <h2>${title}</h2>
            <p>${subtitle}</p>
        `;
        
        // Add animation
        header.classList.remove('animate-fade-in');
        void header.offsetWidth; // Trigger reflow
        header.classList.add('animate-fade-in');
    }

    renderStats() {
        const stats = this.store.getStats();
        
        const elements = {
            totalProducts: document.getElementById('totalProducts'),
            inStock: document.getElementById('inStock'),
            lowStock: document.getElementById('lowStock'),
            outOfStock: document.getElementById('outOfStock')
        };
        
        Object.entries(elements).forEach(([key, el]) => {
            if (!el) return;
            
            const value = {
                totalProducts: stats.total,
                inStock: stats.inStock,
                lowStock: stats.lowStock,
                outOfStock: stats.outOfStock
            }[key];
            
            this.animateNumber(el, parseInt(el.textContent.replace(/,/g, '')), value);
        });
    }

    renderInventoryTable(products) {
        const tbody = document.getElementById('inventoryTable');
        if (!tbody) return;
        
        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem; color: var(--gray-400);">
                        <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                        Tidak ada produk ditemukan
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = products.map(item => {
            const status = this.getStockStatus(item.stock, item.minStock);
            const stockPercent = Utils.calculateStockPercent(item.stock, item.minStock);
            const category = CONSTANTS.CATEGORIES.find(c => c.id === item.category);
            
            return `
                <tr data-id="${item.id}">
                    <td>
                        <div class="product-cell">
                            <div class="product-image">${category?.icon || item.image || '📦'}</div>
                            <div class="product-info">
                                <h4>${this.escapeHtml(item.name)}</h4>
                                <p>${this.escapeHtml(item.location || 'Gudang Utama')}</p>
                            </div>
                        </div>
                    </td>
                    <td>
                        <code style="background: var(--gray-100); padding: 0.25rem 0.5rem; border-radius: var(--radius); font-size: 0.875rem; font-family: monospace;">
                            ${item.sku}
                        </code>
                    </td>
                    <td>${category?.name || item.category}</td>
                    <td>
                        <div style="font-weight: 700;">${item.stock} unit</div>
                        <div class="stock-bar" title="Optimal: ${item.minStock * 3} unit">
                            <div class="stock-fill ${status.class}" style="width: ${stockPercent}%"></div>
                        </div>
                    </td>
                    <td>
                        <span class="badge badge-${status.class}">
                            ${status.label}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline btn-sm" onclick="app.quickStockIn('${item.id}')" title="Stok Masuk">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="app.quickStockOut('${item.id}')" title="Stok Keluar">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="app.editProduct('${item.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderActivities(activities = null) {
        const container = document.getElementById('activityList');
        if (!container) return;
        
        const data = activities || this.store.getRecentActivities(5);
        
        container.innerHTML = data.map(act => {
            const type = CONSTANTS.ACTIVITY_TYPES[act.type] || CONSTANTS.ACTIVITY_TYPES.ADJUST;
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${type.color}">
                        <i class="fas fa-${type.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <h4>${type.label} - ${this.escapeHtml(act.productName)}</h4>
                        <p>${act.quantity ? act.quantity + ' unit' : ''} ${act.note ? '• ' + this.escapeHtml(act.note) : ''}</p>
                    </div>
                    <div class="activity-time">${Utils.formatRelativeTime(act.timestamp)}</div>
                </div>
            `;
        }).join('');
    }

    // Helper Methods
    getStockStatus(stock, minStock) {
        if (stock === 0) return CONSTANTS.STOCK_STATUS.OUT;
        if (stock <= minStock) return CONSTANTS.STOCK_STATUS.LOW;
        return CONSTANTS.STOCK_STATUS.AVAILABLE;
    }

    animateNumber(element, start, end) {
        const range = end - start;
        const duration = 1000;
        const startTime = performance.now();
        
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            const current = Math.floor(start + (range * easeProgress));
            
            element.textContent = Utils.formatNumber(current);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        requestAnimationFrame(update);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Modal Management
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.modals.add(modalId);
        
        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input, select, textarea');
            firstInput?.focus();
        }, 100);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('show');
        this.modals.delete(modalId);
        
        if (this.modals.size === 0) {
            document.body.style.overflow = '';
        }
        
        // Reset form if exists
        const form = modal.querySelector('form');
        if (form) form.reset();
    }

    closeAllModals() {
        [...this.modals].forEach(id => this.closeModal(id));
    }

    toggleSidebar() {
        document.getElementById('sidebar')?.classList.toggle('open');
    }

    // Toast Notifications
    showToast(type, title, message) {
        if (!this.toastContainer) return;
        
        const icons = {
            success: 'check-circle',
            error: 'times-circle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
            <button onclick="this.parentElement.remove()" style="background: none; border: none; color: var(--gray-400); cursor: pointer; padding: 0.5rem;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.toastContainer.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }

    // Actions
    quickStockIn(productId) {
        const product = this.store.getProductById(productId);
        if (!product) return;
        
        const quantity = prompt(`Stok Masuk - ${product.name}\nMasukkan jumlah:`, '1');
        if (!quantity || isNaN(quantity) || quantity <= 0) return;
        
        this.store.adjustStock(productId, parseInt(quantity), 'Quick stock in');
        this.renderInventoryTable(this.store.inventory);
        this.renderStats();
        this.showToast('success', 'Stok Masuk Berhasil', `${quantity} unit ${product.name} ditambahkan`);
    }

    quickStockOut(productId) {
        const product = this.store.getProductById(productId);
        if (!product) return;
        
        const maxOut = product.stock;
        const quantity = prompt(`Stok Keluar - ${product.name}\nMasukkan jumlah (max ${maxOut}):`, '1');
        if (!quantity || isNaN(quantity) || quantity <= 0) return;
        if (parseInt(quantity) > maxOut) {
            this.showToast('error', 'Stok Tidak Cukup', `Tersedia hanya ${maxOut} unit`);
            return;
        }
        
        this.store.adjustStock(productId, -parseInt(quantity), 'Quick stock out');
        this.renderInventoryTable(this.store.inventory);
        this.renderStats();
        this.showToast('success', 'Stok Keluar Berhasil', `${quantity} unit ${product.name} dikurangi`);
    }

    editProduct(productId) {
        const product = this.store.getProductById(productId);
        if (!product) return;
        
        // TODO: Implement edit modal
        this.showToast('info', 'Edit Produk', 'Fitur edit akan segera hadir');
    }

    exportData() {
        Utils.exportToCSV(this.store.inventory, `inventory-${new Date().toISOString().split('T')[0]}.csv`);
        this.showToast('success', 'Export Berhasil', 'Data inventory telah diexport ke CSV');
    }

    setupRealtimeUpdates() {
        // Subscribe to store changes
        this.store.subscribe((event, store) => {
            if (event === 'inventory') {
                this.renderStats();
                if (this.currentPage === 'inventory' || this.currentPage === 'dashboard') {
                    this.renderInventoryTable(store.inventory);
                }
            }
            if (event === 'activities') {
                this.renderActivities();
            }
        });
        
        // Periodic sync simulation
        if (this.store.settings.autoSync) {
            setInterval(() => {
                // Simulate background sync
                console.log('[App] Auto-sync check...');
            }, CONFIG.SYNC_INTERVAL);
        }
    }
}

// ============================================
// FORM HANDLERS
// ============================================

class FormHandler {
    constructor(store, ui) {
        this.store = store;
        this.ui = ui;
        this.init();
    }

    init() {
        // Add Product Form
        const addProductForm = document.getElementById('addProductForm');
        if (addProductForm) {
            addProductForm.addEventListener('submit', (e) => this.handleAddProduct(e));
        }
        
        // Stock In Form
        const stockInForm = document.querySelector('#stockInModal form');
        if (stockInForm) {
            stockInForm.addEventListener('submit', (e) => this.handleStockIn(e));
        }
        
        // Generate SKU button
        const generateSkuBtn = document.getElementById('generateSkuBtn');
        if (generateSkuBtn) {
            generateSkuBtn.addEventListener('click', () => this.generateSKU());
        }
    }

    handleAddProduct(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const product = {
            name: formData.get('name').trim(),
            sku: formData.get('sku').trim().toUpperCase(),
            category: formData.get('category'),
            stock: parseInt(formData.get('stock')) || 0,
            minStock: parseInt(formData.get('minStock')) || 5,
            price: parseInt(formData.get('price')) || 0,
            location: formData.get('location')?.trim(),
            description: formData.get('description')?.trim(),
            image: this.getCategoryIcon(formData.get('category'))
        };
        
        // Validation
        if (!product.name || !product.sku || !product.category) {
            this.ui.showToast('error', 'Validasi Gagal', 'Nama, SKU, dan Kategori wajib diisi');
            return;
        }
        
        if (!Utils.validateSKU(product.sku)) {
            this.ui.showToast('error', 'SKU Invalid', 'Format SKU: XXX-XXX-999 (contoh: KOM-DEL-001)');
            return;
        }
        
        // Check duplicate SKU
        if (this.store.inventory.some(p => p.sku === product.sku)) {
            this.ui.showToast('error', 'SKU Duplikat', 'SKU sudah digunakan oleh produk lain');
            return;
        }
        
        // Save
        this.store.addProduct(product);
        
        // UI Updates
        this.ui.closeModal('addProductModal');
        this.ui.showToast('success', 'Produk Ditambahkan', `${product.name} berhasil ditambahkan`);
        e.target.reset();
        
        // Refresh if on dashboard
        if (this.ui.currentPage === 'dashboard') {
            this.ui.renderInventoryTable(this.store.inventory.slice(0, 5));
        }
    }

    handleStockIn(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const productId = formData.get('product');
        const quantity = parseInt(formData.get('quantity'));
        const note = formData.get('note')?.trim();
        
        if (!productId || !quantity) {
            this.ui.showToast('error', 'Data Tidak Lengkap', 'Pilih produk dan masukkan jumlah');
            return;
        }
        
        const product = this.store.adjustStock(productId, quantity, note || 'Stok masuk manual');
        if (product) {
            this.ui.closeModal('stockInModal');
            this.ui.showToast('success', 'Stok Masuk Berhasil', `${quantity} unit ${product.name} ditambahkan`);
            e.target.reset();
        }
    }

    generateSKU() {
        const nameInput = document.querySelector('input[name="name"]');
        const categoryInput = document.querySelector('select[name="category"]');
        const skuInput = document.querySelector('input[name="sku"]');
        
        if (!nameInput.value || !categoryInput.value) {
            this.ui.showToast('warning', 'Data Kurang', 'Isi nama dan kategori terlebih dahulu');
            return;
        }
        
        const sku = Utils.generateSKU(nameInput.value, categoryInput.value);
        skuInput.value = sku;
    }

    getCategoryIcon(categoryId) {
        const category = CONSTANTS.CATEGORIES.find(c => c.id === categoryId);
        return category?.icon || '📦';
    }
}

// ============================================
// INITIALIZATION
// ============================================

// Global app instance
let app;

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core components
    const store = new DataStore();
    const ui = new UIController(store);
    const forms = new FormHandler(store, ui);
    
    // Create global app reference
    app = {
        store,
        ui,
        forms,
        
        // Expose common methods for onclick handlers
        switchPage: (page) => ui.switchPage(page),
        openModal: (modalId) => ui.openModal(modalId),
        closeModal: (modalId) => ui.closeModal(modalId),
        toggleSidebar: () => ui.toggleSidebar(),
        quickStockIn: (id) => ui.quickStockIn(id),
        quickStockOut: (id) => ui.quickStockOut(id),
        editProduct: (id) => ui.editProduct(id),
        exportData: () => ui.exportData(),
        simulateScan: () => {
            ui.closeModal('scanModal');
            setTimeout(() => {
                ui.showToast('success', 'Barcode Terdeteksi', 'Produk: Laptop Dell XPS 13');
            }, 500);
        }
    };
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        if (e.state?.page) {
            ui.switchPage(e.state.page);
        }
    });
    
    // Service Worker registration (if available)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('[App] SW registered:', reg))
            .catch(err => console.log('[App] SW registration failed:', err));
    }
    
    console.log(`[App] ${CONFIG.APP_NAME} v${CONFIG.VERSION} initialized`);
});

// Handle errors globally
window.addEventListener('error', (e) => {
    console.error('[App] Global error:', e.error);
    if (app?.ui) {
        app.ui.showToast('error', 'Terjadi Kesalahan', 'Silakan refresh halaman');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[App] Unhandled promise rejection:', e.reason);
});
