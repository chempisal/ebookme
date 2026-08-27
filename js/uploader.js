/**
 * Uploader & Studio Portal Logic
 * Handles drag-and-drop PDF uploading, automated page 1 cover extraction via PDF.js,
 * metadata management, library export/import, and book editing/deletion.
 */

class BookUploaderStudio {
    constructor() {
        this.selectedPdfFile = null;
        this.extractedCoverUrl = null;
        this.extractedPagesCount = 1;
        this.customCoverUrl = null;
        this.editingBookId = null;

        this.initElements();
        this.bindEvents();
    }

    initElements() {
        // Dropzone & File inputs
        this.dropzone = document.getElementById('pdf-dropzone');
        this.fileInput = document.getElementById('pdf-file-input');
        this.coverFileInput = document.getElementById('cover-file-input');
        
        // Preview & Form elements
        this.uploadForm = document.getElementById('book-upload-form');
        this.uploadPreviewContainer = document.getElementById('upload-preview-container');
        this.coverPreviewImg = document.getElementById('upload-cover-preview');
        this.extractedPagesBadge = document.getElementById('upload-pages-badge');
        this.extractedSizeBadge = document.getElementById('upload-size-badge');
        this.fileNameBadge = document.getElementById('upload-filename-badge');
        this.presetCoverSelect = document.getElementById('preset-cover-select');

        // Form Fields
        this.titleInput = document.getElementById('book-title-input');
        this.authorInput = document.getElementById('book-author-input');
        this.categorySelect = document.getElementById('book-category-select');
        this.descriptionInput = document.getElementById('book-description-input');
        this.yearInput = document.getElementById('book-year-input');
        this.tagsInput = document.getElementById('book-tags-input');
        this.submitBtn = document.getElementById('upload-submit-btn');
        this.resetBtn = document.getElementById('upload-reset-btn');

        // Google Drive Source Mode & Inputs
        this.srcModeLocalBtn = document.getElementById('src-mode-local');
        this.srcModeGdriveBtn = document.getElementById('src-mode-gdrive');
        this.gdriveInputBox = document.getElementById('gdrive-input-box');
        this.gdriveUrlInput = document.getElementById('gdrive-url-input');
        this.gdriveFetchBtn = document.getElementById('gdrive-fetch-btn');
        this.gdriveOpenDirectBtn = document.getElementById('gdrive-open-direct-btn');

        // Management Table
        this.booksTableBody = document.getElementById('studio-books-table-body');
        this.studioSearchInput = document.getElementById('studio-search-input');
        this.storageTotalBooksEl = document.getElementById('storage-total-books');
        this.storageTotalSizeEl = document.getElementById('storage-total-size');
        this.exportBackupBtn = document.getElementById('export-backup-btn');
        this.importBackupInput = document.getElementById('import-backup-input');
    }

    bindEvents() {
        // Source Mode Toggle (Local File vs Google Drive)
        this.srcModeLocalBtn?.addEventListener('click', () => {
            this.srcModeLocalBtn.classList.add('active');
            this.srcModeGdriveBtn?.classList.remove('active');
            this.dropzone?.classList.remove('hidden');
            this.gdriveInputBox?.classList.add('hidden');
        });

        this.srcModeGdriveBtn?.addEventListener('click', () => {
            this.srcModeGdriveBtn.classList.add('active');
            this.srcModeLocalBtn?.classList.remove('active');
            this.dropzone?.classList.add('hidden');
            this.gdriveInputBox?.classList.remove('hidden');
        });

        // Fetch from Google Drive
        this.gdriveFetchBtn?.addEventListener('click', () => {
            this.handleGoogleDriveImport();
        });

        // Open Link Directly
        this.gdriveOpenDirectBtn?.addEventListener('click', () => {
            const url = this.gdriveUrlInput?.value.trim();
            if (!url) {
                window.app?.showToast('សូមបញ្ចូល Link ក្នុងប្រអប់ជាមុនសិន', 'error');
                return;
            }
            const fileId = this.extractGoogleDriveFileId(url);
            if (fileId) {
                window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
            } else {
                window.open(url, '_blank');
            }
        });
        if (!this.dropzone) return;

        // Drag and Drop Events
        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dropzone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dropzone.classList.remove('drag-over');
            });
        });

        this.dropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                this.handlePdfSelection(files[0]);
            } else {
                window.app?.showToast('សូមជ្រើសរើសឯកសារជា PDF តែប៉ុណ្ណោះ (.pdf)', 'error');
            }
        });

        this.dropzone.addEventListener('click', () => {
            this.fileInput?.click();
        });

        this.fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handlePdfSelection(e.target.files[0]);
            }
        });

        // Custom Cover File
        this.coverFileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (loadEvt) => {
                    this.customCoverUrl = loadEvt.target.result;
                    if (this.coverPreviewImg) {
                        this.coverPreviewImg.src = this.customCoverUrl;
                    }
                    window.app?.showToast('បានប្តូររូបភាពក្របមុខ', 'info');
                };
                reader.readAsDataURL(file);
            }
        });

        // Preset Cover Selection
        this.presetCoverSelect?.addEventListener('change', (e) => {
            const theme = e.target.value;
            if (!theme) return;

            let c1 = '#4f46e5', c2 = '#7c3aed', icon = '📖';
            if (theme === 'blue') { c1 = '#0284c7'; c2 = '#0f172a'; icon = '💻'; }
            if (theme === 'emerald') { c1 = '#059669'; c2 = '#064e3b'; icon = '🚀'; }
            if (theme === 'amber') { c1 = '#d97706'; c2 = '#78350f'; icon = '🏛️'; }
            if (theme === 'rose') { c1 = '#e11d48'; c2 = '#881337'; icon = '✨'; }
            if (theme === 'purple') { c1 = '#9333ea'; c2 = '#4c1d95'; icon = '🔮'; }

            const title = this.titleInput?.value.trim() || 'សៀវភៅថ្មី (New Book)';
            const author = this.authorInput?.value.trim() || 'អ្នកនិពន្ធ (Author)';

            this.customCoverUrl = window.generateArtisticCover(title, author, c1, c2, icon);
            if (this.coverPreviewImg) {
                this.coverPreviewImg.src = this.customCoverUrl;
            }
        });

        // Form Submit
        this.uploadForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        // Form Reset
        this.resetBtn?.addEventListener('click', () => {
            this.resetForm();
        });

        // Studio Search filter
        this.studioSearchInput?.addEventListener('input', () => {
            this.loadStudioBooks();
        });

        // Backup Export & Import
        this.exportBackupBtn?.addEventListener('click', () => this.exportLibraryBackup());
        this.importBackupInput?.addEventListener('change', (e) => this.importLibraryBackup(e));
    }

    extractGoogleDriveFileId(url) {
        if (!url) return null;
        const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (matchD) return matchD[1];
        const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (matchId) return matchId[1];
        if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) return url.trim();
        return null;
    }

    async fetchBlobWithTimeout(url, timeoutMs = 4500) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            const blob = await res.blob();
            if (blob.size < 200) return null;
            
            // Check PDF magic header '%PDF'
            const slice = blob.slice(0, 5);
            const header = await slice.text();
            if (!header.startsWith('%PDF')) {
                // If it returned an HTML page instead of PDF binary, ignore this candidate
                return null;
            }
            return blob;
        } catch (e) {
            clearTimeout(timer);
            return null;
        }
    }

    async handleGoogleDriveImport() {
        const url = this.gdriveUrlInput?.value.trim();
        if (!url) {
            window.app?.showToast('សូមបញ្ចូល Google Drive Share Link ឬ PDF URL', 'error');
            this.gdriveUrlInput?.focus();
            return;
        }

        const fileId = this.extractGoogleDriveFileId(url);
        window.app?.showLoading('កំពុងទាញយកឯកសារ PDF (Fetching Cloud PDF)...');

        try {
            let candidateUrls = [];
            if (fileId) {
                const directGdriveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                const userContentUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`;
                candidateUrls = [
                    userContentUrl,
                    directGdriveUrl,
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(directGdriveUrl)}`,
                    `https://corsproxy.io/?${encodeURIComponent(directGdriveUrl)}`,
                    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directGdriveUrl)}`
                ];
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                candidateUrls = [
                    url,
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                    `https://corsproxy.io/?${encodeURIComponent(url)}`
                ];
            } else {
                throw new Error('INVALID_LINK');
            }

            let blob = null;
            for (const testUrl of candidateUrls) {
                blob = await this.fetchBlobWithTimeout(testUrl, 4500);
                if (blob) break;
            }

            if (!blob) {
                throw new Error('CORS_OR_PERMISSION_ERROR');
            }

            const fileName = fileId ? `GoogleDrive_Book_${fileId.substring(0, 8)}.pdf` : (url.split('/').pop().split('?')[0] || 'imported_book.pdf');
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const pdfFile = new File([pdfBlob], fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, { type: 'application/pdf' });

            await this.handlePdfSelection(pdfFile);
            window.app?.showToast('បានទាញយកសៀវភៅជោគជ័យ!', 'success');

        } catch (err) {
            console.error('Google Drive Fetch Error:', err);
            window.app?.hideLoading();
            if (err.message === 'CORS_OR_PERMISSION_ERROR') {
                window.app?.showToast('Google Drive រារាំងការទាញយកដោយស្វ័យប្រវត្ត។ សូមចុច "🔗 បើក Link ផ្ទាល់" ដើម្បីទាញយកមកម៉ាស៊ីន រួចទម្លាក់ចូល!', 'warning');
            } else if (err.message === 'INVALID_LINK') {
                window.app?.showToast('Link មិនត្រឹមត្រូវ សូមពិនិត្យឡើងវិញ', 'error');
            } else {
                window.app?.showToast('មិនអាចទាញយកបានទេ។ សូមពិនិត្យ Link ឡើងវិញ', 'error');
            }
        } finally {
            window.app?.hideLoading();
        }
    }

    async handlePdfSelection(file) {
        if (!file || file.type !== 'application/pdf') {
            window.app?.showToast('សូមជ្រើសរើសឯកសារ PDF ដែលត្រឹមត្រូវ', 'error');
            return;
        }

        try {
            window.app?.showLoading('កំពុងដំណើរការពិនិត្យឯកសារ PDF (Processing PDF)...');
            this.selectedPdfFile = file;

            // Update UI Badges
            if (this.fileNameBadge) this.fileNameBadge.textContent = file.name;
            if (this.extractedSizeBadge) this.extractedSizeBadge.textContent = window.bookDB.formatBytes(file.size);

            // Auto fill title if empty
            const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            if (this.titleInput && !this.titleInput.value) {
                this.titleInput.value = cleanTitle;
            }

            // Read PDF using PDF.js to extract page count and cover preview
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            const pdfDoc = await loadingTask.promise;

            this.extractedPagesCount = pdfDoc.numPages;
            if (this.extractedPagesBadge) {
                this.extractedPagesBadge.textContent = `${this.extractedPagesCount} ទំព័រ`;
            }

            // Extract metadata if available
            try {
                const meta = await pdfDoc.getMetadata();
                if (meta && meta.info) {
                    if (meta.info.Title && !this.titleInput.value) {
                        this.titleInput.value = meta.info.Title;
                    }
                    if (meta.info.Author && this.authorInput && !this.authorInput.value) {
                        this.authorInput.value = meta.info.Author;
                    }
                }
            } catch (e) {
                console.warn('Could not read PDF metadata info', e);
            }

            // Extract Page 1 Cover image
            const firstPage = await pdfDoc.getPage(1);
            const viewport = firstPage.getViewport({ scale: 1.0 });
            
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = viewport.width;
            offscreenCanvas.height = viewport.height;
            const ctx = offscreenCanvas.getContext('2d');

            await firstPage.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;

            this.extractedCoverUrl = offscreenCanvas.toDataURL('image/png');
            this.customCoverUrl = null; // Clear custom cover to use auto-extracted one

            if (this.coverPreviewImg) {
                this.coverPreviewImg.src = this.extractedCoverUrl;
            }

            if (this.uploadPreviewContainer) {
                this.uploadPreviewContainer.classList.remove('hidden');
            }

            window.app?.showToast(`បានទាញយកទិន្នន័យ PDF ជោគជ័យ (${this.extractedPagesCount} ទំព័រ)`, 'success');

        } catch (err) {
            console.error('Error processing PDF:', err);
            window.app?.showToast('មិនអាចទាញយកទិន្នន័យពីឯកសារ PDF នេះបានទេ', 'error');
        } finally {
            window.app?.hideLoading();
        }
    }

    async handleFormSubmit() {
        const title = this.titleInput?.value.trim();
        const author = this.authorInput?.value.trim() || 'អនាមិក (Anonymous)';
        const category = this.categorySelect?.value || 'ទូទៅ (General)';
        const description = this.descriptionInput?.value.trim() || '';
        const publishedYear = parseInt(this.yearInput?.value, 10) || new Date().getFullYear();
        const tags = this.tagsInput?.value ? this.tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [];

        if (!title) {
            window.app?.showToast('សូមបញ្ចូលចំណងជើងសៀវភៅ', 'error');
            this.titleInput?.focus();
            return;
        }

        // If editing existing book
        if (this.editingBookId) {
            try {
                window.app?.showLoading('កំពុងកែប្រែទិន្នន័យសៀវភៅ...');
                const updateData = {
                    title,
                    author,
                    category,
                    description,
                    publishedYear,
                    tags
                };

                if (this.customCoverUrl) {
                    updateData.coverImage = this.customCoverUrl;
                }

                if (this.selectedPdfFile) {
                    updateData.pdfData = this.selectedPdfFile;
                    updateData.fileSize = this.selectedPdfFile.size;
                    updateData.fileName = this.selectedPdfFile.name;
                    updateData.totalPages = this.extractedPagesCount;
                }

                await window.bookDB.updateBook(this.editingBookId, updateData);
                window.app?.hideLoading();
                window.app?.showToast('បានកែប្រែសៀវភៅជោគជ័យ!', 'success');
                this.resetForm();
                this.loadStudioBooks();
                window.app?.loadBooksCatalog();
            } catch (err) {
                console.error(err);
                window.app?.hideLoading();
                window.app?.showToast('មានបញ្ហាក្នុងការកែប្រែសៀវភៅ', 'error');
            }
            return;
        }

        // Creating New Book
        if (!this.selectedPdfFile) {
            window.app?.showToast('សូមអាប់ឡូតឯកសារ PDF មួយជាមុនសិន', 'error');
            return;
        }

        try {
            window.app?.showLoading('កំពុងរក្សាទុកសៀវភៅទៅក្នុងបណ្ណាល័យ...');

            const finalCover = this.customCoverUrl || this.extractedCoverUrl || window.generateArtisticCover(title, author, '#4f46e5', '#7c3aed', '📖');

            const bookRecord = {
                title,
                author,
                category,
                description,
                coverImage: finalCover,
                pdfData: this.selectedPdfFile,
                totalPages: this.extractedPagesCount,
                fileSize: this.selectedPdfFile.size,
                fileName: this.selectedPdfFile.name,
                publishedYear,
                tags,
                rating: 5.0,
                readsCount: 0,
                createdAt: Date.now()
            };

            await window.bookDB.saveBook(bookRecord);

            // Cloud Sync to Google Sheets if connected
            if (window.cloudSheet.isConnected()) {
                window.cloudSheet.saveBookToSheet(bookRecord);
            }

            window.app?.hideLoading();
            window.app?.showToast(`សៀវភៅ "${title}" ត្រូវបានបញ្ចូលជោគជ័យ!`, 'success');

            this.resetForm();
            this.loadStudioBooks();
            window.app?.loadBooksCatalog();

        } catch (err) {
            console.error('Error saving book:', err);
            window.app?.hideLoading();
            window.app?.showToast('មានបញ្ហាក្នុងការរក្សាទុកសៀវភៅ', 'error');
        }
    }

    resetForm() {
        this.selectedPdfFile = null;
        this.extractedCoverUrl = null;
        this.customCoverUrl = null;
        this.extractedPagesCount = 1;
        this.editingBookId = null;

        if (this.uploadForm) this.uploadForm.reset();
        if (this.fileInput) this.fileInput.value = '';
        if (this.coverFileInput) this.coverFileInput.value = '';
        if (this.uploadPreviewContainer) this.uploadPreviewContainer.classList.add('hidden');
        if (this.submitBtn) this.submitBtn.textContent = '🚀 រក្សាទុក និងបោះពុម្ព (Publish Book)';
        
        const formTitle = document.getElementById('upload-form-title');
        if (formTitle) formTitle.textContent = '📤 អាប់ឡូតសៀវភៅ PDF ថ្មី (Upload New Book)';
    }

    async loadStudioBooks() {
        if (!this.booksTableBody) return;
        
        const books = await window.bookDB.getAllBooks();
        const searchTerm = this.studioSearchInput?.value.toLowerCase().trim() || '';

        const filteredBooks = books.filter(b => {
            return b.title.toLowerCase().includes(searchTerm) ||
                   (b.author && b.author.toLowerCase().includes(searchTerm)) ||
                   (b.category && b.category.toLowerCase().includes(searchTerm));
        });

        // Update Storage Statistics
        const stats = await window.bookDB.getStorageStats();
        if (this.storageTotalBooksEl) this.storageTotalBooksEl.textContent = stats.totalBooks;
        if (this.storageTotalSizeEl) this.storageTotalSizeEl.textContent = stats.formattedSize;

        if (filteredBooks.length === 0) {
            this.booksTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-empty-state">
                        <span class="empty-icon">📂</span>
                        <p>មិនទាន់មានសៀវភៅក្នុងប្រព័ន្ធនៅឡើយទេ</p>
                    </td>
                </tr>
            `;
            return;
        }

        this.booksTableBody.innerHTML = filteredBooks.map((book, idx) => {
            const formattedDate = new Date(book.createdAt).toLocaleDateString('km-KH');
            const sizeStr = window.bookDB.formatBytes(book.fileSize || 0);

            return `
                <tr data-book-id="${book.id}">
                    <td class="col-num">${idx + 1}</td>
                    <td class="col-cover">
                        <img src="${book.coverImage || 'assets/default-cover.svg'}" alt="${escapeHtml(book.title)}" class="studio-table-thumb" />
                    </td>
                    <td class="col-title">
                        <div class="table-book-title">${escapeHtml(book.title)}</div>
                        <small class="table-book-author">${escapeHtml(book.author)}</small>
                    </td>
                    <td class="col-category">
                        <span class="table-badge category-badge">${escapeHtml(book.category)}</span>
                    </td>
                    <td class="col-pages">${book.totalPages || 1} ទំព័រ</td>
                    <td class="col-size">${sizeStr}</td>
                    <td class="col-actions">
                        <button class="table-btn btn-read" data-action="read" title="អានសៀវភៅ">📖 អាន</button>
                        <button class="table-btn btn-edit" data-action="edit" title="កែប្រែ">✏️ កែ</button>
                        <button class="table-btn btn-delete" data-action="delete" title="លុប">🗑️ លុប</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind table action buttons
        this.booksTableBody.querySelectorAll('tr').forEach(row => {
            const bookId = row.dataset.bookId;
            row.querySelector('[data-action="read"]')?.addEventListener('click', () => {
                window.pdfStudio?.openBook(bookId);
            });

            row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
                this.startEditBook(bookId);
            });

            row.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
                this.confirmDeleteBook(bookId);
            });
        });
    }

    async startEditBook(bookId) {
        const book = await window.bookDB.getBookById(bookId);
        if (!book) return;

        this.editingBookId = bookId;
        if (this.titleInput) this.titleInput.value = book.title;
        if (this.authorInput) this.authorInput.value = book.author;
        if (this.categorySelect) this.categorySelect.value = book.category;
        if (this.descriptionInput) this.descriptionInput.value = book.description || '';
        if (this.yearInput) this.yearInput.value = book.publishedYear || new Date().getFullYear();
        if (this.tagsInput) this.tagsInput.value = (book.tags || []).join(', ');

        if (this.coverPreviewImg) {
            this.coverPreviewImg.src = book.coverImage;
        }
        if (this.uploadPreviewContainer) {
            this.uploadPreviewContainer.classList.remove('hidden');
        }

        if (this.fileNameBadge) this.fileNameBadge.textContent = book.fileName || 'ឯកសារបច្ចុប្បន្ន';
        if (this.extractedPagesBadge) this.extractedPagesBadge.textContent = `${book.totalPages} ទំព័រ`;
        if (this.extractedSizeBadge) this.extractedSizeBadge.textContent = window.bookDB.formatBytes(book.fileSize || 0);

        if (this.submitBtn) this.submitBtn.textContent = '💾 រក្សាទុកការកែប្រែ (Save Changes)';
        const formTitle = document.getElementById('upload-form-title');
        if (formTitle) formTitle.textContent = `✏️ កែប្រែសៀវភៅ: "${book.title}"`;

        // Scroll to form
        this.uploadForm?.scrollIntoView({ behavior: 'smooth' });
        window.app?.showToast(`កំពុងកែប្រែ: ${book.title}`, 'info');
    }

    async confirmDeleteBook(bookId) {
        const book = await window.bookDB.getBookById(bookId);
        if (!book) return;

        if (confirm(`តើអ្នកពិតជាចង់លុបសៀវភៅ "${book.title}" មែនទេ?`)) {
            await window.bookDB.deleteBook(bookId);
            
            // Cloud Delete from Google Sheets if connected
            if (window.cloudSheet.isConnected()) {
                window.cloudSheet.deleteBookFromSheet(bookId);
            }

            window.app?.showToast(`បានលុបសៀវភៅ "${book.title}"`, 'info');
            this.loadStudioBooks();
            window.app?.loadBooksCatalog();
            window.app?.loadMyLibrary();
        }
    }

    async exportLibraryBackup() {
        try {
            window.app?.showLoading('កំពុងរៀបចំ Backup...');
            const books = await window.bookDB.getAllBooks();
            const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                booksCount: books.length,
                books: books.map(b => ({
                    id: b.id,
                    title: b.title,
                    author: b.author,
                    category: b.category,
                    description: b.description,
                    coverImage: b.coverImage,
                    totalPages: b.totalPages,
                    fileSize: b.fileSize,
                    fileName: b.fileName,
                    language: b.language,
                    publishedYear: b.publishedYear,
                    tags: b.tags,
                    rating: b.rating
                }))
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `khmer_bookstore_backup_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            window.app?.hideLoading();
            window.app?.showToast('បានទាញយក Backup ជោគជ័យ', 'success');
        } catch (err) {
            console.error('Backup error:', err);
            window.app?.hideLoading();
            window.app?.showToast('បរាជ័យក្នុងការ Export Backup', 'error');
        }
    }

    async importLibraryBackup(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            window.app?.showLoading('កំពុង Import Backup...');
            const text = await file.text();
            const json = JSON.parse(text);

            if (json.books && Array.isArray(json.books)) {
                for (const b of json.books) {
                    await window.bookDB.saveBook(b);
                }
                window.app?.hideLoading();
                window.app?.showToast(`បានបញ្ចូលសៀវភៅចំនួន ${json.books.length} ក្បាល!`, 'success');
                this.loadStudioBooks();
                window.app?.loadBooksCatalog();
            } else {
                throw new Error('Invalid backup JSON format');
            }
        } catch (err) {
            console.error('Import error:', err);
            window.app?.hideLoading();
            window.app?.showToast('ឯកសារ Backup មិនត្រឹមត្រូវ', 'error');
        }
        e.target.value = '';
    }
}

window.uploaderStudio = new BookUploaderStudio();
