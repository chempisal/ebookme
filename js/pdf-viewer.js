/**
 * Advanced PDF Viewer Engine
 * Powered by PDF.js with Multi-Mode rendering (Single, Scroll, Spread),
 * Dark/Sepia/Day Themes, Thumbnails, Bookmarks, Annotations & Auto-Progress Tracking.
 */

class PDFReaderStudio {
    constructor() {
        this.pdfDoc = null;
        this.currentBook = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.scale = 1.25;
        this.minScale = 0.5;
        this.maxScale = 3.0;
        this.viewMode = 'single'; // 'single', 'scroll', 'spread'
        this.readingTheme = 'day'; // 'day', 'sepia', 'dark'
        this.isRendering = false;
        this.pageRenderingQueue = null;
        this.pdfDataUrl = null;
        this.sidebarTab = 'thumbnails'; // 'thumbnails', 'bookmarks', 'info'
        this.isFullscreen = false;

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Modal & Containers
        this.modal = document.getElementById('pdf-reader-modal');
        this.canvasContainer = document.getElementById('reader-canvas-container');
        this.thumbnailsList = document.getElementById('reader-thumbnails-list');
        this.bookmarksList = document.getElementById('reader-bookmarks-list');
        this.sidebar = document.getElementById('reader-sidebar');

        // Header controls
        this.bookTitleEl = document.getElementById('reader-book-title');
        this.bookAuthorEl = document.getElementById('reader-book-author');
        this.closeBtn = document.getElementById('reader-close-btn');
        this.fullscreenBtn = document.getElementById('reader-fullscreen-btn');
        this.sidebarToggleBtn = document.getElementById('reader-sidebar-toggle');
        
        // Theme & View mode selectors
        this.themeDayBtn = document.getElementById('theme-day-btn');
        this.themeSepiaBtn = document.getElementById('theme-sepia-btn');
        this.themeDarkBtn = document.getElementById('theme-dark-btn');

        this.viewSingleBtn = document.getElementById('view-single-btn');
        this.viewScrollBtn = document.getElementById('view-scroll-btn');
        this.viewSpreadBtn = document.getElementById('view-spread-btn');

        // Bottom floating navigation
        this.prevPageBtn = document.getElementById('reader-prev-btn');
        this.nextPageBtn = document.getElementById('reader-next-btn');
        this.pageInput = document.getElementById('reader-page-input');
        this.totalPagesEl = document.getElementById('reader-total-pages');
        this.pageSlider = document.getElementById('reader-page-slider');
        this.zoomInBtn = document.getElementById('reader-zoom-in');
        this.zoomOutBtn = document.getElementById('reader-zoom-out');
        this.zoomResetBtn = document.getElementById('reader-zoom-reset');
        this.fitWidthBtn = document.getElementById('reader-fit-width');
        this.progressBar = document.getElementById('reader-top-progress');

        // Bookmark controls
        this.addBookmarkBtn = document.getElementById('reader-add-bookmark-btn');
        this.bookmarkNoteInput = document.getElementById('reader-bookmark-note-input');
        this.saveBookmarkBtn = document.getElementById('reader-save-bookmark-btn');

        // Sidebar Tabs
        this.tabThumbsBtn = document.getElementById('tab-thumbnails-btn');
        this.tabBookmarksBtn = document.getElementById('tab-bookmarks-btn');
    }

    bindEvents() {
        if (!this.modal) return;

        // Close Reader
        this.closeBtn?.addEventListener('click', () => this.close());

        // Navigation
        this.prevPageBtn?.addEventListener('click', () => this.changePage(-1));
        this.nextPageBtn?.addEventListener('click', () => this.changePage(1));

        this.pageInput?.addEventListener('change', (e) => {
            const pageNum = parseInt(e.target.value, 10);
            if (pageNum >= 1 && pageNum <= this.totalPages) {
                this.goToPage(pageNum);
            } else {
                this.pageInput.value = this.currentPage;
            }
        });

        this.pageSlider?.addEventListener('input', (e) => {
            const pageNum = parseInt(e.target.value, 10);
            if (pageNum >= 1 && pageNum <= this.totalPages) {
                this.goToPage(pageNum);
            }
        });

        // Zooming
        this.zoomInBtn?.addEventListener('click', () => this.zoom(0.2));
        this.zoomOutBtn?.addEventListener('click', () => this.zoom(-0.2));
        this.zoomResetBtn?.addEventListener('click', () => this.setZoom(1.0));
        this.fitWidthBtn?.addEventListener('click', () => this.fitToWidth());

        // Fullscreen
        this.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());

        // Sidebar Toggle
        this.sidebarToggleBtn?.addEventListener('click', () => {
            this.sidebar?.classList.toggle('hidden');
        });

        // Theme switching
        this.themeDayBtn?.addEventListener('click', () => this.setTheme('day'));
        this.themeSepiaBtn?.addEventListener('click', () => this.setTheme('sepia'));
        this.themeDarkBtn?.addEventListener('click', () => this.setTheme('dark'));

        // View mode switching
        this.viewSingleBtn?.addEventListener('click', () => this.setViewMode('single'));
        this.viewScrollBtn?.addEventListener('click', () => this.setViewMode('scroll'));
        this.viewSpreadBtn?.addEventListener('click', () => this.setViewMode('spread'));

        // Sidebar Tab switching
        this.tabThumbsBtn?.addEventListener('click', () => this.switchSidebarTab('thumbnails'));
        this.tabBookmarksBtn?.addEventListener('click', () => this.switchSidebarTab('bookmarks'));

        // Add Bookmark
        this.saveBookmarkBtn?.addEventListener('click', () => this.saveCurrentBookmark());

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen()) return;

            // Don't intercept if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                e.preventDefault();
                this.changePage(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                e.preventDefault();
                this.changePage(-1);
            } else if (e.key === 'Escape') {
                if (this.isFullscreen) {
                    this.exitFullscreen();
                } else {
                    this.close();
                }
            } else if (e.key === '+' || e.key === '=') {
                this.zoom(0.2);
            } else if (e.key === '-' || e.key === '_') {
                this.zoom(-0.2);
            } else if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            }
        });
    }

    isOpen() {
        return this.modal && !this.modal.classList.contains('hidden');
    }

    async openBook(bookId) {
        try {
            window.app?.showLoading('កំពុងបើកសៀវភៅ (Loading PDF)...');
            const book = await window.bookDB.getBookById(bookId);
            if (!book) {
                window.app?.showToast('រកមិនឃើញសៀវភៅនេះទេ', 'error');
                window.app?.hideLoading();
                return;
            }

            this.currentBook = book;
            this.bookTitleEl.textContent = book.title;
            this.bookAuthorEl.textContent = book.author || '';

            // Retrieve reading progress if any
            const progress = await window.bookDB.getProgress(bookId);
            this.currentPage = progress ? progress.currentPage : 1;

            // Prepare PDF Data for PDF.js
            let pdfSource;
            if (book.pdfData instanceof Blob) {
                const arrayBuffer = await book.pdfData.arrayBuffer();
                pdfSource = { data: new Uint8Array(arrayBuffer) };
            } else if (book.pdfData instanceof ArrayBuffer) {
                pdfSource = { data: new Uint8Array(book.pdfData) };
            } else if (typeof book.pdfData === 'string' && book.pdfData.startsWith('data:')) {
                const base64 = book.pdfData.split(',')[1];
                const binaryStr = atob(base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                pdfSource = { data: bytes };
            } else {
                pdfSource = book.pdfData;
            }

            // Load PDF.js document
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js library is not loaded');
            }

            // Configure worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

            const loadingTask = pdfjsLib.getDocument(pdfSource);
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;

            // Update Total Pages in UI
            if (this.totalPagesEl) this.totalPagesEl.textContent = this.totalPages;
            if (this.pageSlider) {
                this.pageSlider.max = this.totalPages;
                this.pageSlider.value = this.currentPage;
            }

            // Increment read stats
            window.bookDB.incrementReadCount(bookId);

            // Open Modal
            this.modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';

            // Render current page
            await this.render();

            // Load Thumbnails & Bookmarks in background
            this.loadThumbnails();
            this.loadBookmarks();

            // Update View Modes & Themes active state
            this.updateThemeClasses();
            this.updateViewModeClasses();

            window.app?.hideLoading();
            window.app?.showToast(`កំពុងអាន: ${book.title}`, 'info');

        } catch (err) {
            console.error('Failed to open PDF:', err);
            window.app?.hideLoading();
            window.app?.showToast('មានបញ្ហាក្នុងការបើកឯកសារ PDF នេះ', 'error');
        }
    }

    async render() {
        if (!this.pdfDoc) return;

        if (this.viewMode === 'scroll') {
            await this.renderContinuousScroll();
        } else if (this.viewMode === 'spread') {
            await this.renderSpreadView();
        } else {
            await this.renderSinglePage(this.currentPage);
        }

        this.updateUIControls();
        this.saveProgress();
    }

    async renderSinglePage(pageNum) {
        if (!this.canvasContainer) return;
        this.canvasContainer.innerHTML = '';
        this.canvasContainer.className = `reader-viewport theme-${this.readingTheme} mode-single`;

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper single-page-card';
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        pageWrapper.appendChild(canvas);
        this.canvasContainer.appendChild(pageWrapper);

        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: this.scale });

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const ctx = canvas.getContext('2d');
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
            canvasContext: ctx,
            transform: transform,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        this.highlightActiveThumbnail(pageNum);
    }

    async renderSpreadView() {
        if (!this.canvasContainer) return;
        this.canvasContainer.innerHTML = '';
        this.canvasContainer.className = `reader-viewport theme-${this.readingTheme} mode-spread`;

        const spreadWrapper = document.createElement('div');
        spreadWrapper.className = 'pdf-spread-container';

        // Left Page
        const leftPageNum = this.currentPage;
        // Right Page (if exists)
        const rightPageNum = leftPageNum + 1 <= this.totalPages ? leftPageNum + 1 : null;

        const pagesToRender = [leftPageNum];
        if (rightPageNum) pagesToRender.push(rightPageNum);

        for (const pNum of pagesToRender) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper spread-page-card';
            
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            pageWrapper.appendChild(canvas);
            spreadWrapper.appendChild(pageWrapper);

            const page = await this.pdfDoc.getPage(pNum);
            const spreadScale = this.scale * 0.85; // slightly smaller scale for spread
            const viewport = page.getViewport({ scale: spreadScale });
            const outputScale = window.devicePixelRatio || 1;

            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';

            const ctx = canvas.getContext('2d');
            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

            await page.render({
                canvasContext: ctx,
                transform: transform,
                viewport: viewport
            }).promise;
        }

        this.canvasContainer.appendChild(spreadWrapper);
        this.highlightActiveThumbnail(this.currentPage);
    }

    async renderContinuousScroll() {
        if (!this.canvasContainer) return;
        this.canvasContainer.innerHTML = '';
        this.canvasContainer.className = `reader-viewport theme-${this.readingTheme} mode-scroll`;

        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'pdf-scroll-stream';

        for (let pNum = 1; pNum <= this.totalPages; pNum++) {
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper scroll-page-item';
            pageWrapper.dataset.pageNum = pNum;

            const pageHeader = document.createElement('div');
            pageHeader.className = 'scroll-page-indicator';
            pageHeader.textContent = `ទំព័រទី ${pNum} / ${this.totalPages}`;
            pageWrapper.appendChild(pageHeader);

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            pageWrapper.appendChild(canvas);
            scrollContainer.appendChild(pageWrapper);

            const page = await this.pdfDoc.getPage(pNum);
            const viewport = page.getViewport({ scale: this.scale });
            const outputScale = window.devicePixelRatio || 1;

            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';

            const ctx = canvas.getContext('2d');
            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

            await page.render({
                canvasContext: ctx,
                transform: transform,
                viewport: viewport
            }).promise;
        }

        this.canvasContainer.appendChild(scrollContainer);

        // Track scroll position to update current page indicator
        this.canvasContainer.addEventListener('scroll', () => {
            const pageItems = this.canvasContainer.querySelectorAll('.scroll-page-item');
            const containerTop = this.canvasContainer.scrollTop + 150;

            for (const item of pageItems) {
                const top = item.offsetTop;
                const height = item.offsetHeight;
                if (containerTop >= top && containerTop < top + height) {
                    const p = parseInt(item.dataset.pageNum, 10);
                    if (p !== this.currentPage) {
                        this.currentPage = p;
                        this.updateUIControls();
                        this.saveProgress();
                        this.highlightActiveThumbnail(p);
                    }
                    break;
                }
            }
        });
    }

    async loadThumbnails() {
        if (!this.thumbnailsList || !this.pdfDoc) return;
        this.thumbnailsList.innerHTML = '';

        for (let pNum = 1; pNum <= this.totalPages; pNum++) {
            const thumbCard = document.createElement('div');
            thumbCard.className = `thumbnail-item ${pNum === this.currentPage ? 'active' : ''}`;
            thumbCard.dataset.pageNum = pNum;

            const canvas = document.createElement('canvas');
            canvas.className = 'thumbnail-canvas';
            thumbCard.appendChild(canvas);

            const label = document.createElement('span');
            label.className = 'thumbnail-page-num';
            label.textContent = `${pNum}`;
            thumbCard.appendChild(label);

            thumbCard.addEventListener('click', () => {
                this.goToPage(pNum);
            });

            this.thumbnailsList.appendChild(thumbCard);

            // Render mini canvas asynchronously
            (async () => {
                const page = await this.pdfDoc.getPage(pNum);
                const viewport = page.getViewport({ scale: 0.25 });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport
                }).promise;
            })();
        }
    }

    async loadBookmarks() {
        if (!this.bookmarksList || !this.currentBook) return;
        this.bookmarksList.innerHTML = '';

        const bookmarks = await window.bookDB.getBookmarksForBook(this.currentBook.id);
        if (bookmarks.length === 0) {
            this.bookmarksList.innerHTML = `
                <div class="empty-bookmarks-msg">
                    <span class="empty-icon">🔖</span>
                    <p>មិនទាន់មានចំណាំទំព័រនៅឡើយទេ</p>
                    <small>ចុចប៊ូតុង "បន្ថែមចំណាំ" ខាងលើដើម្បីរក្សាទុកទំព័រសំខាន់ៗ</small>
                </div>
            `;
            return;
        }

        bookmarks.forEach(bm => {
            const item = document.createElement('div');
            item.className = 'bookmark-card-item';
            item.innerHTML = `
                <div class="bookmark-info">
                    <div class="bookmark-title">📌 ${bm.title}</div>
                    ${bm.note ? `<div class="bookmark-note">${escapeHtml(bm.note)}</div>` : ''}
                    <div class="bookmark-date">${new Date(bm.createdAt).toLocaleDateString('km-KH')}</div>
                </div>
                <div class="bookmark-actions">
                    <button class="bm-jump-btn" title="ទៅកាន់ទំព័រនេះ">📖</button>
                    <button class="bm-del-btn" title="លុបចំណាំ">🗑️</button>
                </div>
            `;

            item.querySelector('.bm-jump-btn').addEventListener('click', () => {
                this.goToPage(bm.page);
            });

            item.querySelector('.bm-del-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.bookDB.deleteBookmark(bm.id);
                this.loadBookmarks();
                window.app?.showToast('បានលុបចំណាំទំព័រ', 'info');
            });

            this.bookmarksList.appendChild(item);
        });
    }

    async saveCurrentBookmark() {
        if (!this.currentBook) return;
        const note = this.bookmarkNoteInput?.value.trim() || '';
        await window.bookDB.addBookmark(this.currentBook.id, this.currentPage, note, `ទំព័រទី ${this.currentPage}`);
        if (this.bookmarkNoteInput) this.bookmarkNoteInput.value = '';
        this.loadBookmarks();
        window.app?.showToast(`បានបន្ថែមចំណាំទំព័រទី ${this.currentPage}`, 'success');
    }

    highlightActiveThumbnail(pageNum) {
        if (!this.thumbnailsList) return;
        const items = this.thumbnailsList.querySelectorAll('.thumbnail-item');
        items.forEach(item => {
            if (parseInt(item.dataset.pageNum, 10) === pageNum) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    changePage(delta) {
        const step = this.viewMode === 'spread' ? 2 : 1;
        const targetPage = this.currentPage + (delta * step);
        if (targetPage >= 1 && targetPage <= this.totalPages) {
            this.goToPage(targetPage);
        }
    }

    goToPage(pageNum) {
        this.currentPage = Math.max(1, Math.min(this.totalPages, pageNum));
        this.render();
    }

    zoom(delta) {
        const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale + delta));
        if (newScale !== this.scale) {
            this.scale = parseFloat(newScale.toFixed(2));
            this.render();
            window.app?.showToast(`Zoom: ${Math.round(this.scale * 100)}%`, 'info');
        }
    }

    setZoom(scale) {
        this.scale = scale;
        this.render();
    }

    fitToWidth() {
        if (!this.canvasContainer) return;
        const containerWidth = this.canvasContainer.clientWidth - 80;
        this.scale = Math.max(0.6, Math.min(2.5, containerWidth / 612));
        this.render();
    }

    setTheme(themeName) {
        this.readingTheme = themeName;
        this.updateThemeClasses();
        this.render();
    }

    updateThemeClasses() {
        [this.themeDayBtn, this.themeSepiaBtn, this.themeDarkBtn].forEach(btn => btn?.classList.remove('active'));
        if (this.readingTheme === 'day') this.themeDayBtn?.classList.add('active');
        if (this.readingTheme === 'sepia') this.themeSepiaBtn?.classList.add('active');
        if (this.readingTheme === 'dark') this.themeDarkBtn?.classList.add('active');

        if (this.modal) {
            this.modal.setAttribute('data-reader-theme', this.readingTheme);
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.updateViewModeClasses();
        this.render();
    }

    updateViewModeClasses() {
        [this.viewSingleBtn, this.viewScrollBtn, this.viewSpreadBtn].forEach(btn => btn?.classList.remove('active'));
        if (this.viewMode === 'single') this.viewSingleBtn?.classList.add('active');
        if (this.viewMode === 'scroll') this.viewScrollBtn?.classList.add('active');
        if (this.viewMode === 'spread') this.viewSpreadBtn?.classList.add('active');
    }

    switchSidebarTab(tabName) {
        this.sidebarTab = tabName;
        if (tabName === 'thumbnails') {
            this.tabThumbsBtn?.classList.add('active');
            this.tabBookmarksBtn?.classList.remove('active');
            this.thumbnailsList?.classList.remove('hidden');
            this.bookmarksList?.classList.add('hidden');
            document.getElementById('bookmark-composer-box')?.classList.add('hidden');
        } else {
            this.tabThumbsBtn?.classList.remove('active');
            this.tabBookmarksBtn?.classList.add('active');
            this.thumbnailsList?.classList.add('hidden');
            this.bookmarksList?.classList.remove('hidden');
            document.getElementById('bookmark-composer-box')?.classList.remove('hidden');
        }
    }

    updateUIControls() {
        if (this.pageInput) this.pageInput.value = this.currentPage;
        if (this.pageSlider) this.pageSlider.value = this.currentPage;

        const progressPercent = Math.round((this.currentPage / this.totalPages) * 100);
        if (this.progressBar) {
            this.progressBar.style.width = `${progressPercent}%`;
        }

        if (this.prevPageBtn) this.prevPageBtn.disabled = this.currentPage <= 1;
        if (this.nextPageBtn) this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
    }

    async saveProgress() {
        if (this.currentBook) {
            await window.bookDB.saveProgress(this.currentBook.id, this.currentPage, this.totalPages);
            // Notify main app to refresh currently reading shelf if active
            window.app?.refreshMyLibraryStats();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.modal.requestFullscreen?.().then(() => {
                this.isFullscreen = true;
                if (this.fullscreenBtn) this.fullscreenBtn.textContent = '🗗';
            }).catch(err => console.warn('Fullscreen error:', err));
        } else {
            this.exitFullscreen();
        }
    }

    exitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen?.().then(() => {
                this.isFullscreen = false;
                if (this.fullscreenBtn) this.fullscreenBtn.textContent = '⛶';
            });
        }
    }

    close() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        this.pdfDoc = null;
        this.currentBook = null;
        this.canvasContainer.innerHTML = '';
        window.app?.loadBooksCatalog();
        window.app?.loadMyLibrary();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;');
}

window.pdfStudio = new PDFReaderStudio();
