/**
 * BookStore IndexedDB Storage Layer
 * Handles persistent storage for PDF Blobs, Metadata, Reading Progress, Bookmarks, and Notes.
 */

class BookDatabase {
    constructor() {
        this.dbName = 'KhmerDigitalBookstoreDB';
        this.dbVersion = 2;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Books Store (holds metadata and binary PDF file)
                if (!db.objectStoreNames.contains('books')) {
                    const bookStore = db.createObjectStore('books', { keyPath: 'id' });
                    bookStore.createIndex('category', 'category', { unique: false });
                    bookStore.createIndex('createdAt', 'createdAt', { unique: false });
                    bookStore.createIndex('title', 'title', { unique: false });
                }

                // Reading Progress Store
                if (!db.objectStoreNames.contains('progress')) {
                    const progressStore = db.createObjectStore('progress', { keyPath: 'bookId' });
                    progressStore.createIndex('lastReadAt', 'lastReadAt', { unique: false });
                }

                // User Favorites Store
                if (!db.objectStoreNames.contains('favorites')) {
                    db.createObjectStore('favorites', { keyPath: 'bookId' });
                }

                // Bookmarks & Notes Store
                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
                    bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
                    bookmarkStore.createIndex('page', 'page', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // --- Book CRUD Operations ---

    async getAllBooks() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('books', 'readonly');
            const store = tx.objectStore('books');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async getBookById(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('books', 'readonly');
            const store = tx.objectStore('books');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveBook(bookData) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('books', 'readwrite');
            const store = tx.objectStore('books');
            
            const bookRecord = {
                id: bookData.id || 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                title: bookData.title,
                titleEn: bookData.titleEn || '',
                author: bookData.author || 'អនាមិក (Anonymous)',
                category: bookData.category || 'ទូទៅ (General)',
                description: bookData.description || '',
                coverImage: bookData.coverImage || null, // Base64 or Blob URL
                pdfData: bookData.pdfData, // Blob or ArrayBuffer or Base64
                totalPages: bookData.totalPages || 1,
                fileSize: bookData.fileSize || 0,
                fileName: bookData.fileName || 'document.pdf',
                language: bookData.language || 'ខ្មែរ (Khmer)',
                publishedYear: bookData.publishedYear || new Date().getFullYear(),
                tags: bookData.tags || [],
                rating: bookData.rating || 4.8,
                readsCount: bookData.readsCount || 0,
                createdAt: bookData.createdAt || Date.now(),
                updatedAt: Date.now()
            };

            const request = store.put(bookRecord);
            request.onsuccess = () => resolve(bookRecord);
            request.onerror = () => reject(request.error);
        });
    }

    async updateBook(id, updateFields) {
        const book = await this.getBookById(id);
        if (!book) throw new Error('Book not found');

        const updated = { ...book, ...updateFields, updatedAt: Date.now() };
        return await this.saveBook(updated);
    }

    async deleteBook(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['books', 'progress', 'favorites', 'bookmarks'], 'readwrite');
            
            // Delete book
            tx.objectStore('books').delete(id);
            // Delete related progress
            tx.objectStore('progress').delete(id);
            // Delete related favorite
            tx.objectStore('favorites').delete(id);

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async incrementReadCount(id) {
        try {
            const book = await this.getBookById(id);
            if (book) {
                book.readsCount = (book.readsCount || 0) + 1;
                await this.saveBook(book);
            }
        } catch (e) {
            console.warn('Failed to increment read count', e);
        }
    }

    // --- Reading Progress Operations ---

    async getProgress(bookId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('progress', 'readonly');
            const store = tx.objectStore('progress');
            const request = store.get(bookId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllProgress() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('progress', 'readonly');
            const store = tx.objectStore('progress');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveProgress(bookId, currentPage, totalPages) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('progress', 'readwrite');
            const store = tx.objectStore('progress');
            
            const progressPercentage = Math.min(100, Math.round((currentPage / (totalPages || 1)) * 100));
            const progressData = {
                bookId: bookId,
                currentPage: currentPage,
                totalPages: totalPages,
                percentage: progressPercentage,
                isCompleted: currentPage >= totalPages,
                lastReadAt: Date.now()
            };

            const request = store.put(progressData);
            request.onsuccess = () => resolve(progressData);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Favorites Operations ---

    async toggleFavorite(bookId) {
        await this.init();
        const isFav = await this.isFavorite(bookId);
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('favorites', 'readwrite');
            const store = tx.objectStore('favorites');
            
            if (isFav) {
                const request = store.delete(bookId);
                request.onsuccess = () => resolve(false);
                request.onerror = () => reject(request.error);
            } else {
                const request = store.put({ bookId, addedAt: Date.now() });
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            }
        });
    }

    async isFavorite(bookId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('favorites', 'readonly');
            const store = tx.objectStore('favorites');
            const request = store.get(bookId);

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFavorites() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('favorites', 'readonly');
            const store = tx.objectStore('favorites');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Bookmarks & Notes Operations ---

    async getBookmarksForBook(bookId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('bookmarks', 'readonly');
            const store = tx.objectStore('bookmarks');
            const index = store.index('bookId');
            const request = index.getAll(bookId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async addBookmark(bookId, page, note = '', title = '') {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('bookmarks', 'readwrite');
            const store = tx.objectStore('bookmarks');
            const bookmark = {
                bookId,
                page,
                title: title || `ទំព័រទី ${page}`,
                note: note,
                createdAt: Date.now()
            };

            const request = store.add(bookmark);
            request.onsuccess = () => {
                bookmark.id = request.result;
                resolve(bookmark);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBookmark(bookmarkId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('bookmarks', 'readwrite');
            const store = tx.objectStore('bookmarks');
            const request = store.delete(bookmarkId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // --- Backup & Storage Stats ---

    async getStorageStats() {
        const books = await this.getAllBooks();
        let totalBytes = 0;
        
        books.forEach(b => {
            if (b.fileSize) totalBytes += b.fileSize;
            else if (b.pdfData && b.pdfData.size) totalBytes += b.pdfData.size;
            else if (b.pdfData && typeof b.pdfData === 'string') totalBytes += b.pdfData.length;
        });

        return {
            totalBooks: books.length,
            totalBytes: totalBytes,
            formattedSize: this.formatBytes(totalBytes)
        };
    }

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }
}

// Export singleton instance
window.bookDB = new BookDatabase();
