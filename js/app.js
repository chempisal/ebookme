/**
 * Main Application Orchestrator
 * Controls navigation, catalog rendering, book details modal, search & filter,
 * favorites, and user preferences.
 */

class BookstoreApp {
    constructor() {
        this.currentView = 'reader'; // 'reader', 'my-library', 'uploader'
        this.selectedCategory = 'all';
        this.searchQuery = '';
        this.sortBy = 'newest'; // 'newest', 'rating', 'reads', 'title'
        this.theme = localStorage.getItem('kb_theme') || 'dark';

        this.initElements();
        this.bindEvents();
    }

    async start() {
        this.applyTheme(this.theme);
        
        // Initialize DB & Sample Data
        await window.bookDB.init();
        await window.seedInitialBooks();

        // Update Cloud Sync Status in UI
        this.updateCloudStatusUI();

        // Load initial views
        await this.loadBooksCatalog();
        await this.loadHeroFeatured();
        await this.loadMyLibrary();
        window.uploaderStudio?.loadStudioBooks();

        // Auto background sync from Google Sheets if connected
        if (window.cloudSheet.isConnected()) {
            this.autoSyncFromCloudBackground();
        }

        console.log('Bookstore App initialized successfully.');
    }

    initElements() {
        // Navigation Links
        this.navLinks = document.querySelectorAll('.nav-tab-btn');
        this.views = {
            'reader': document.getElementById('view-reader'),
            'my-library': document.getElementById('view-my-library'),
            'uploader': document.getElementById('view-uploader')
        };

        // Theme Toggle
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');

        // Search & Category Filters
        this.mainSearchInput = document.getElementById('main-search-input');
        this.categoryPills = document.querySelectorAll('.category-pill');
        this.sortSelect = document.getElementById('sort-select');

        // Catalog Containers
        this.booksGrid = document.getElementById('books-catalog-grid');
        this.booksCountLabel = document.getElementById('catalog-books-count');
        this.heroFeaturedContainer = document.getElementById('hero-featured-content');

        // My Library Containers
        this.continueReadingGrid = document.getElementById('continue-reading-grid');
        this.favoritesGrid = document.getElementById('favorites-grid');
        this.historyGrid = document.getElementById('history-grid');

        // Book Detail Modal
        this.detailModal = document.getElementById('book-detail-modal');
        this.detailCloseBtn = document.getElementById('detail-modal-close');
        this.detailCover = document.getElementById('detail-cover-img');
        this.detailTitle = document.getElementById('detail-title');
        this.detailAuthor = document.getElementById('detail-author');
        this.detailCategory = document.getElementById('detail-category');
        this.detailPages = document.getElementById('detail-pages');
        this.detailYear = document.getElementById('detail-year');
        this.detailRating = document.getElementById('detail-rating');
        this.detailDescription = document.getElementById('detail-description');
        this.detailTags = document.getElementById('detail-tags');
        this.detailReadBtn = document.getElementById('detail-read-btn');
        this.detailFavBtn = document.getElementById('detail-fav-btn');
        this.detailDownloadBtn = document.getElementById('detail-download-btn');

        // Toast Container & Loading
        this.toastContainer = document.getElementById('toast-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-overlay-text');
        this.cancelLoadingBtn = document.getElementById('cancel-loading-btn');

        // Cloud Sync Modal & Elements
        this.cloudSyncBtn = document.getElementById('cloud-sync-btn');
        this.cloudSyncModal = document.getElementById('cloud-sync-modal');
        this.cloudSyncCloseBtn = document.getElementById('cloud-sync-close-btn');
        this.cloudScriptUrlInput = document.getElementById('cloud-script-url-input');
        this.btnSaveCloudConfig = document.getElementById('btn-save-cloud-config');
        this.btnDisconnectCloud = document.getElementById('btn-disconnect-cloud');
        this.btnQuickSync = document.getElementById('btn-quick-sync');
        this.btnPushAllToCloud = document.getElementById('btn-push-all-to-cloud');
        this.btnPullAllFromCloud = document.getElementById('btn-pull-all-from-cloud');
        this.btnCopyAppsScript = document.getElementById('btn-copy-apps-script');
        this.cloudStatusDot = document.getElementById('cloud-status-badge');
        this.cloudStatusText = document.getElementById('cloud-status-text');
    }

    bindEvents() {
        // Cancel Loading button
        this.cancelLoadingBtn?.addEventListener('click', () => {
            this.hideLoading();
            this.showToast('បានបិទការទាញយក', 'info');
        });

        // Click outside loading spinner to cancel
        this.loadingOverlay?.addEventListener('click', (e) => {
            if (e.target === this.loadingOverlay) {
                this.hideLoading();
            }
        });

        // Cloud Sync Modal Open/Close
        this.cloudSyncBtn?.addEventListener('click', () => {
            this.openCloudSyncModal();
        });

        this.cloudSyncCloseBtn?.addEventListener('click', () => {
            this.closeCloudSyncModal();
        });

        this.cloudSyncModal?.addEventListener('click', (e) => {
            if (e.target === this.cloudSyncModal) {
                this.closeCloudSyncModal();
            }
        });

        // Cloud Sync Actions
        this.btnSaveCloudConfig?.addEventListener('click', async () => {
            const url = this.cloudScriptUrlInput?.value.trim();
            if (!url) {
                this.showToast('សូមបញ្ចូល Google Apps Script Web App URL', 'error');
                return;
            }
            if (!url.startsWith('https://script.google.com/')) {
                this.showToast('URL ត្រូវតែចាប់ផ្តើមដោយ https://script.google.com/macros/s/...', 'error');
                return;
            }

            try {
                this.showLoading('កំពុងពិនិត្យ និងភ្ជាប់ Google Sheets...');
                window.cloudSheet.setScriptUrl(url);
                
                // Test fetch
                const books = await window.cloudSheet.fetchBooksFromSheet();
                this.hideLoading();
                this.updateCloudStatusUI();
                this.showToast(`ភ្ជាប់ជោគជ័យ! រកឃើញសៀវភៅ ${books.length} លើ Google Sheets`, 'success');
                
                if (books.length > 0) {
                    await window.cloudSheet.syncAllFromSheet();
                    this.loadBooksCatalog();
                    this.loadMyLibrary();
                    window.uploaderStudio?.loadStudioBooks();
                }
            } catch (err) {
                this.hideLoading();
                console.error(err);
                this.showToast('មិនអាចភ្ជាប់ Google Sheet បានទេ។ សូមពិនិត្យ Web App URL ឬសិទ្ធិ "Anyone"', 'error');
            }
        });

        this.btnDisconnectCloud?.addEventListener('click', () => {
            if (confirm('តើអ្នកពិតជាចង់ផ្តាច់ការភ្ជាប់ Google Sheets មែនទេ?')) {
                window.cloudSheet.disconnect();
                if (this.cloudScriptUrlInput) this.cloudScriptUrlInput.value = '';
                this.updateCloudStatusUI();
                this.showToast('បានផ្តាច់ការតភ្ជាប់ Google Sheets', 'info');
            }
        });

        this.btnQuickSync?.addEventListener('click', async () => {
            await this.performCloudSync();
        });

        this.btnPullAllFromCloud?.addEventListener('click', async () => {
            await this.performCloudSync();
        });

        this.btnPushAllToCloud?.addEventListener('click', async () => {
            if (!window.cloudSheet.isConnected()) {
                this.showToast('សូមភ្ជាប់ Google Sheet ជាមុនសិន', 'error');
                return;
            }
            try {
                this.showLoading('កំពុងបញ្ជូនសៀវភៅទាំងអស់ទៅ Google Sheet...');
                const count = await window.cloudSheet.syncAllToSheet();
                this.hideLoading();
                this.updateCloudStatusUI();
                this.showToast(`បានបញ្ជូនសៀវភៅ ${count} ក្បាលទៅ Google Sheet ជោគជ័យ!`, 'success');
            } catch (err) {
                this.hideLoading();
                console.error(err);
                this.showToast('មានបញ្ហាក្នុងការបញ្ជូនទិន្នន័យ', 'error');
            }
        });

        this.btnCopyAppsScript?.addEventListener('click', () => {
            const code = window.cloudSheet.getGoogleAppsScriptCode();
            navigator.clipboard.writeText(code).then(() => {
                this.showToast('បានចម្លងកូដ Apps Script ទៅ Clipboard រួចរាល់!', 'success');
            }).catch(() => {
                this.showToast('បរាជ័យក្នុងការចម្លង', 'error');
            });
        });

        // View Navigation
        this.navLinks.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetView = btn.dataset.view;
                this.switchView(targetView);
            });
        });

        // Theme Toggle
        this.themeToggleBtn?.addEventListener('click', () => {
            const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
            this.applyTheme(nextTheme);
        });

        // Search Input with debounce
        let searchTimeout;
        this.mainSearchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.loadBooksCatalog();
            }, 250);
        });

        // Category Pills
        this.categoryPills.forEach(pill => {
            pill.addEventListener('click', () => {
                this.categoryPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.selectedCategory = pill.dataset.category;
                this.loadBooksCatalog();
            });
        });

        // Sort Selector
        this.sortSelect?.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.loadBooksCatalog();
        });

        // Book Detail Modal Close
        this.detailCloseBtn?.addEventListener('click', () => {
            this.closeDetailModal();
        });

        this.detailModal?.addEventListener('click', (e) => {
            if (e.target === this.detailModal) {
                this.closeDetailModal();
            }
        });
    }

    switchView(viewName) {
        if (!this.views[viewName]) return;
        this.currentView = viewName;

        this.navLinks.forEach(btn => {
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        Object.keys(this.views).forEach(key => {
            if (key === viewName) {
                this.views[key]?.classList.remove('hidden');
            } else {
                this.views[key]?.classList.add('hidden');
            }
        });

        if (viewName === 'reader') {
            this.loadBooksCatalog();
        } else if (viewName === 'my-library') {
            this.loadMyLibrary();
        } else if (viewName === 'uploader') {
            window.uploaderStudio?.loadStudioBooks();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    applyTheme(theme) {
        this.theme = theme;
        localStorage.setItem('kb_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);

        if (this.themeToggleBtn) {
            this.themeToggleBtn.innerHTML = theme === 'dark' ? '☀️ <span class="nav-label">ពន្លឺ</span>' : '🌙 <span class="nav-label">ងងឹត</span>';
        }
    }

    async loadHeroFeatured() {
        if (!this.heroFeaturedContainer) return;
        const books = await window.bookDB.getAllBooks();
        if (books.length === 0) return;

        // Choose highest rated or first book
        const featured = books[0];

        this.heroFeaturedContainer.innerHTML = `
            <div class="hero-featured-card">
                <div class="hero-cover-wrap">
                    <div class="book-3d-wrapper">
                        <img src="${featured.coverImage}" alt="${escapeHtml(featured.title)}" class="hero-cover-img" />
                    </div>
                </div>
                <div class="hero-info">
                    <div class="hero-badge">🌟 សៀវភៅឆ្នើមប្រចាំសប្តាហ៍ (Featured Masterpiece)</div>
                    <h2 class="hero-title">${escapeHtml(featured.title)}</h2>
                    <p class="hero-author">និពន្ធដោយ: <strong>${escapeHtml(featured.author)}</strong> | ${featured.category}</p>
                    <p class="hero-desc">${escapeHtml(featured.description)}</p>
                    <div class="hero-meta-row">
                        <span class="hero-meta-item">⭐ ${featured.rating || 5.0} ពិន្ទុ</span>
                        <span class="hero-meta-item">📄 ${featured.totalPages || 1} ទំព័រ</span>
                        <span class="hero-meta-item">👥 ${featured.readsCount || 100}+ អ្នកបានអាន</span>
                    </div>
                    <div class="hero-actions">
                        <button class="btn-primary hero-read-btn" data-book-id="${featured.id}">
                            📖 ចាប់ផ្តើមអានឥឡូវនេះ (Read Now)
                        </button>
                        <button class="btn-secondary hero-detail-btn" data-book-id="${featured.id}">
                            ℹ️ ព័ត៌មានលម្អិត (Details)
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.heroFeaturedContainer.querySelector('.hero-read-btn')?.addEventListener('click', () => {
            window.pdfStudio?.openBook(featured.id);
        });

        this.heroFeaturedContainer.querySelector('.hero-detail-btn')?.addEventListener('click', () => {
            this.openDetailModal(featured.id);
        });
    }

    async loadBooksCatalog() {
        if (!this.booksGrid) return;
        
        let books = await window.bookDB.getAllBooks();

        // Filter by Category
        if (this.selectedCategory && this.selectedCategory !== 'all') {
            books = books.filter(b => {
                const cat = (b.category || '').toLowerCase();
                return cat.includes(this.selectedCategory.toLowerCase());
            });
        }

        // Filter by Search Query
        if (this.searchQuery) {
            books = books.filter(b => {
                return b.title.toLowerCase().includes(this.searchQuery) ||
                       (b.author && b.author.toLowerCase().includes(this.searchQuery)) ||
                       (b.category && b.category.toLowerCase().includes(this.searchQuery)) ||
                       (b.tags && b.tags.some(t => t.toLowerCase().includes(this.searchQuery)));
            });
        }

        // Sort Books
        if (this.sortBy === 'rating') {
            books.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        } else if (this.sortBy === 'reads') {
            books.sort((a, b) => (b.readsCount || 0) - (a.readsCount || 0));
        } else if (this.sortBy === 'title') {
            books.sort((a, b) => a.title.localeCompare(b.title));
        } else {
            // Newest
            books.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }

        if (this.booksCountLabel) {
            this.booksCountLabel.textContent = `(${books.length} សៀវភៅ)`;
        }

        if (books.length === 0) {
            this.booksGrid.innerHTML = `
                <div class="empty-catalog-state">
                    <span class="empty-icon">🔍</span>
                    <h3>រកមិនឃើញសៀវភៅដែលត្រូវនឹងការស្វែងរករបស់អ្នកឡើយ</h3>
                    <p>សូមសាកល្បងស្វែងរកដោយប្រើពាក្យគន្លឹះផ្សេង ឬ <a href="#" id="empty-clear-filter">សម្អាត Filter</a></p>
                </div>
            `;

            document.getElementById('empty-clear-filter')?.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.mainSearchInput) this.mainSearchInput.value = '';
                this.searchQuery = '';
                this.selectedCategory = 'all';
                this.categoryPills.forEach(p => p.classList.toggle('active', p.dataset.category === 'all'));
                this.loadBooksCatalog();
            });

            return;
        }

        // Get favorites map
        const favs = await window.bookDB.getAllFavorites();
        const favMap = new Set(favs.map(f => f.bookId));

        // Get progress map
        const progressList = await window.bookDB.getAllProgress();
        const progressMap = new Map(progressList.map(p => [p.bookId, p]));

        this.booksGrid.innerHTML = books.map(book => {
            const isFav = favMap.has(book.id);
            const prog = progressMap.get(book.id);
            const percent = prog ? prog.percentage : 0;

            return `
                <div class="book-card" data-book-id="${book.id}">
                    <div class="book-card-cover-wrap">
                        <img src="${book.coverImage}" alt="${escapeHtml(book.title)}" class="book-card-cover" loading="lazy" />
                        <button class="book-card-fav-btn ${isFav ? 'favorited' : ''}" data-action="fav" title="ចំណូលចិត្ត">
                            ${isFav ? '❤️' : '🤍'}
                        </button>
                        <span class="book-card-badge">${escapeHtml(book.category)}</span>
                        ${prog && percent > 0 ? `
                            <div class="book-card-progress-bar-wrap" title="អានបាន ${percent}%">
                                <div class="book-card-progress-bar" style="width: ${percent}%"></div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="book-card-body">
                        <h3 class="book-card-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
                        <p class="book-card-author">✍️ ${escapeHtml(book.author)}</p>
                        <div class="book-card-footer">
                            <span class="book-card-rating">⭐ ${book.rating || 4.9}</span>
                            <span class="book-card-pages">📄 ${book.totalPages || 1} ទំព័រ</span>
                        </div>
                        <div class="book-card-actions">
                            <button class="btn-primary card-read-btn" data-action="read">
                                📖 ${prog && percent > 0 ? `អានបន្ត (${prog.currentPage}/${book.totalPages})` : 'អានសៀវភៅ'}
                            </button>
                            <button class="btn-icon card-info-btn" data-action="detail" title="ព័ត៌មានលម្អិត">
                                ℹ️
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to book cards
        this.booksGrid.querySelectorAll('.book-card').forEach(card => {
            const bookId = card.dataset.bookId;

            card.querySelector('[data-action="read"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                window.pdfStudio?.openBook(bookId);
            });

            card.querySelector('[data-action="detail"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDetailModal(bookId);
            });

            card.querySelector('[data-action="fav"]')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const nowFav = await window.bookDB.toggleFavorite(bookId);
                const btn = e.currentTarget;
                btn.classList.toggle('favorited', nowFav);
                btn.innerHTML = nowFav ? '❤️' : '🤍';
                this.showToast(nowFav ? 'បានបន្ថែមទៅក្នុងបញ្ជីចូលចិត្ត' : 'បានដកចេញពីបញ្ជីចូលចិត្ត', 'info');
                this.loadMyLibrary();
            });

            card.addEventListener('click', () => {
                this.openDetailModal(bookId);
            });
        });
    }

    async loadMyLibrary() {
        const allBooks = await window.bookDB.getAllBooks();
        const bookMap = new Map(allBooks.map(b => [b.id, b]));

        // 1. Continue Reading Shelf
        const progressList = await window.bookDB.getAllProgress();
        const activeReading = progressList
            .filter(p => p.percentage < 100 && bookMap.has(p.bookId))
            .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));

        if (this.continueReadingGrid) {
            if (activeReading.length === 0) {
                this.continueReadingGrid.innerHTML = `
                    <div class="empty-shelf-msg">
                        <span class="empty-icon">📖</span>
                        <p>មិនទាន់មានសៀវភៅកំពុងអាននៅឡើយទេ</p>
                        <small>សូមជ្រើសរើសសៀវភៅណាមួយក្នុងបណ្ណាល័យដើម្បីចាប់ផ្តើមអាន</small>
                    </div>
                `;
            } else {
                this.continueReadingGrid.innerHTML = activeReading.map(p => {
                    const book = bookMap.get(p.bookId);
                    return `
                        <div class="continue-card" data-book-id="${book.id}">
                            <img src="${book.coverImage}" class="continue-thumb" alt="${escapeHtml(book.title)}" />
                            <div class="continue-info">
                                <h4 class="continue-title">${escapeHtml(book.title)}</h4>
                                <p class="continue-author">${escapeHtml(book.author)}</p>
                                <div class="continue-progress-row">
                                    <div class="progress-bar-bg">
                                        <div class="progress-bar-fill" style="width: ${p.percentage}%"></div>
                                    </div>
                                    <span class="progress-label">${p.percentage}%</span>
                                </div>
                                <div class="continue-footer-row">
                                    <span class="continue-page-status">ទំព័រ ${p.currentPage} នៃ ${p.totalPages}</span>
                                    <button class="btn-resume-read" data-action="resume">អានបន្ត ➔</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                this.continueReadingGrid.querySelectorAll('[data-action="resume"]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const bookId = e.target.closest('.continue-card').dataset.bookId;
                        window.pdfStudio?.openBook(bookId);
                    });
                });
            }
        }

        // 2. Favorites Shelf
        const favList = await window.bookDB.getAllFavorites();
        const favBooks = favList.map(f => bookMap.get(f.bookId)).filter(Boolean);

        if (this.favoritesGrid) {
            if (favBooks.length === 0) {
                this.favoritesGrid.innerHTML = `
                    <div class="empty-shelf-msg">
                        <span class="empty-icon">❤️</span>
                        <p>មិនទាន់មានសៀវភៅក្នុងបញ្ជីពេញចិត្តទេ</p>
                        <small>ចុចសញ្ញាបេះដូងលើសៀវភៅដើម្បីរក្សាទុកក្នុងបញ្ជីនេះ</small>
                    </div>
                `;
            } else {
                this.favoritesGrid.innerHTML = favBooks.map(book => `
                    <div class="fav-item-card" data-book-id="${book.id}">
                        <img src="${book.coverImage}" class="fav-thumb" alt="${escapeHtml(book.title)}" />
                        <div class="fav-info">
                            <h4 class="fav-title">${escapeHtml(book.title)}</h4>
                            <p class="fav-author">${escapeHtml(book.author)}</p>
                            <div class="fav-btn-row">
                                <button class="btn-read-sm" data-action="read">📖 អាន</button>
                                <button class="btn-remove-fav" data-action="unfav" title="ដកចេញ">✕</button>
                            </div>
                        </div>
                    </div>
                `).join('');

                this.favoritesGrid.querySelectorAll('.fav-item-card').forEach(card => {
                    const bookId = card.dataset.bookId;
                    card.querySelector('[data-action="read"]')?.addEventListener('click', () => {
                        window.pdfStudio?.openBook(bookId);
                    });
                    card.querySelector('[data-action="unfav"]')?.addEventListener('click', async () => {
                        await window.bookDB.toggleFavorite(bookId);
                        this.loadMyLibrary();
                        this.loadBooksCatalog();
                        this.showToast('បានដកចេញពីបញ្ជីចូលចិត្ត', 'info');
                    });
                });
            }
        }

        // 3. Completed / Reading History
        const historyList = progressList
            .filter(p => bookMap.has(p.bookId))
            .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0));

        if (this.historyGrid) {
            if (historyList.length === 0) {
                this.historyGrid.innerHTML = `
                    <div class="empty-shelf-msg">
                        <span class="empty-icon">📜</span>
                        <p>មិនទាន់មានប្រវត្តិអាននៅឡើយទេ</p>
                    </div>
                `;
            } else {
                this.historyGrid.innerHTML = historyList.map(p => {
                    const book = bookMap.get(p.bookId);
                    const lastReadDate = new Date(p.lastReadAt).toLocaleDateString('km-KH');
                    return `
                        <div class="history-item-row" data-book-id="${book.id}">
                            <img src="${book.coverImage}" class="history-thumb" alt="${escapeHtml(book.title)}" />
                            <div class="history-main">
                                <div class="history-title">${escapeHtml(book.title)}</div>
                                <div class="history-meta">អានចុងក្រោយ: ${lastReadDate} | ទំព័រ ${p.currentPage}/${p.totalPages} (${p.percentage}%)</div>
                            </div>
                            <div class="history-status">
                                ${p.isCompleted ? '<span class="badge-done">✅ អានចប់</span>' : '<span class="badge-reading">⏳ កំពុងអាន</span>'}
                            </div>
                            <button class="btn-read-history" data-action="read">📖</button>
                        </div>
                    `;
                }).join('');

                this.historyGrid.querySelectorAll('[data-action="read"]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const bookId = e.target.closest('.history-item-row').dataset.bookId;
                        window.pdfStudio?.openBook(bookId);
                    });
                });
            }
        }
    }

    refreshMyLibraryStats() {
        this.loadMyLibrary();
    }

    async openDetailModal(bookId) {
        const book = await window.bookDB.getBookById(bookId);
        if (!book) return;

        const isFav = await window.bookDB.isFavorite(bookId);
        const prog = await window.bookDB.getProgress(bookId);

        if (this.detailCover) this.detailCover.src = book.coverImage;
        if (this.detailTitle) this.detailTitle.textContent = book.title;
        if (this.detailAuthor) this.detailAuthor.textContent = book.author;
        if (this.detailCategory) this.detailCategory.textContent = book.category;
        if (this.detailPages) this.detailPages.textContent = `${book.totalPages || 1} ទំព័រ`;
        if (this.detailYear) this.detailYear.textContent = book.publishedYear || '—';
        if (this.detailRating) this.detailRating.textContent = `⭐ ${book.rating || 5.0}`;
        if (this.detailDescription) this.detailDescription.textContent = book.description || 'មិនមានការពិពណ៌នាបន្ថែម';

        // Tags
        if (this.detailTags) {
            this.detailTags.innerHTML = (book.tags || []).map(t => `<span class="detail-tag-pill">#${escapeHtml(t)}</span>`).join('');
        }

        // Favorite button state
        if (this.detailFavBtn) {
            this.detailFavBtn.innerHTML = isFav ? '❤️ ដកចេញពីចំណូលចិត្ត' : '🤍 បន្ថែមទៅចំណូលចិត្ត';
            this.detailFavBtn.onclick = async () => {
                const nowFav = await window.bookDB.toggleFavorite(bookId);
                this.detailFavBtn.innerHTML = nowFav ? '❤️ ដកចេញពីចំណូលចិត្ត' : '🤍 បន្ថែមទៅចំណូលចិត្ត';
                this.showToast(nowFav ? 'បានបន្ថែមទៅក្នុងបញ្ជីចូលចិត្ត' : 'បានដកចេញពីបញ្ជីចូលចិត្ត', 'info');
                this.loadBooksCatalog();
                this.loadMyLibrary();
            };
        }

        // Read button
        if (this.detailReadBtn) {
            this.detailReadBtn.innerHTML = prog && prog.percentage > 0 ? `📖 អានបន្ត (ទំព័រទី ${prog.currentPage})` : '📖 ចាប់ផ្តើមអាន (Read Now)';
            this.detailReadBtn.onclick = () => {
                this.closeDetailModal();
                window.pdfStudio?.openBook(bookId);
            };
        }

        // Download button
        if (this.detailDownloadBtn) {
            this.detailDownloadBtn.onclick = () => {
                this.downloadBookPdf(book);
            };
        }

        // Google Drive Save / Backup action
        const gdriveBtn = document.getElementById('detail-gdrive-save-btn');
        if (gdriveBtn) {
            gdriveBtn.onclick = () => {
                // Trigger download first so user has the file
                this.downloadBookPdf(book);
                this.showToast('កំពុងបើក Google Drive... អ្នកអាចទម្លាក់ File PDF ចូល Drive របស់អ្នក', 'info');
                setTimeout(() => {
                    window.open('https://drive.google.com/drive/my-drive', '_blank');
                }, 1000);
            };
        }

        this.detailModal?.classList.remove('hidden');
    }

    closeDetailModal() {
        this.detailModal?.classList.add('hidden');
    }

    downloadBookPdf(book) {
        try {
            let blob = book.pdfData;
            if (!(blob instanceof Blob)) {
                if (blob instanceof ArrayBuffer) {
                    blob = new Blob([blob], { type: 'application/pdf' });
                } else if (typeof blob === 'string') {
                    blob = new Blob([blob], { type: 'application/pdf' });
                }
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = book.fileName || `${book.title}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            this.showToast('បានចាប់ផ្តើមទាញយកឯកសារ PDF', 'success');
        } catch (e) {
            console.error('Download error:', e);
            this.showToast('មានបញ្ហាក្នុងការទាញយកឯកសារ', 'error');
        }
    }

    updateCloudStatusUI() {
        const isConnected = window.cloudSheet.isConnected();
        if (this.cloudStatusDot) {
            this.cloudStatusDot.className = `cloud-status-dot ${isConnected ? 'connected' : 'disconnected'}`;
        }
        if (this.cloudStatusText) {
            this.cloudStatusText.textContent = isConnected ? 'Cloud: 🟢' : 'Google Sheet';
        }

        const modalDot = document.getElementById('modal-status-dot');
        const modalTitle = document.getElementById('modal-status-title');
        const banner = document.getElementById('cloud-status-banner');
        const lastSyncLabel = document.getElementById('cloud-last-sync-label');

        if (modalDot) {
            modalDot.className = `status-indicator-dot ${isConnected ? 'connected' : ''}`;
        }
        if (modalTitle) {
            modalTitle.textContent = isConnected ? 'ស្ថានភាព: បានភ្ជាប់ Google Sheets រួចរាល់ 🟢' : 'ស្ថានភាព: មិនទាន់ភ្ជាប់ ⚪';
        }
        if (banner) {
            banner.classList.toggle('connected', isConnected);
        }
        if (lastSyncLabel && window.cloudSheet.lastSyncTime) {
            lastSyncLabel.textContent = `Sync ចុងក្រោយ: ${window.cloudSheet.lastSyncTime}`;
        }
    }

    openCloudSyncModal() {
        if (!this.cloudSyncModal) return;
        if (this.cloudScriptUrlInput) {
            this.cloudScriptUrlInput.value = window.cloudSheet.scriptUrl || '';
        }
        this.updateCloudStatusUI();
        this.cloudSyncModal.classList.remove('hidden');
    }

    closeCloudSyncModal() {
        this.cloudSyncModal?.classList.add('hidden');
    }

    async performCloudSync() {
        if (!window.cloudSheet.isConnected()) {
            this.showToast('សូមបញ្ចូល និងភ្ជាប់ Google Apps Script URL ជាមុនសិន', 'error');
            return;
        }

        try {
            this.showLoading('កំពុង Sync ទិន្នន័យពី Google Sheets...');
            const count = await window.cloudSheet.syncAllFromSheet();
            this.hideLoading();
            this.updateCloudStatusUI();
            this.loadBooksCatalog();
            this.loadMyLibrary();
            window.uploaderStudio?.loadStudioBooks();
            this.showToast(`Sync ជោគជ័យ! បានទាញយកសៀវភៅ ${count} ក្បាលពី Google Sheet`, 'success');
        } catch (err) {
            this.hideLoading();
            console.error(err);
            this.showToast('មានបញ្ហាក្នុងការទាញយកទិន្នន័យពី Google Sheet', 'error');
        }
    }

    async autoSyncFromCloudBackground() {
        try {
            console.log('[CloudSync] Performing background sync with Google Sheets...');
            const count = await window.cloudSheet.syncAllFromSheet();
            if (count > 0) {
                this.loadBooksCatalog();
                this.loadMyLibrary();
                window.uploaderStudio?.loadStudioBooks();
                this.showToast(`Cloud Sync: បានធ្វើបច្ចុប្បន្នភាពសៀវភៅ ${count} ក្បាលពី Google Sheets!`, 'info');
            }
        } catch (err) {
            console.warn('[CloudSync] Background sync failed:', err);
        }
    }

    showToast(message, type = 'info') {
        if (!this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-msg">${escapeHtml(message)}</span>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    showLoading(text = 'កំពុងដំណើរការ...') {
        if (this.loadingOverlay) {
            if (this.loadingText) this.loadingText.textContent = text;
            this.loadingOverlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('hidden');
        }
    }
}

// Global App instantiation
window.app = new BookstoreApp();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app.start();
});
