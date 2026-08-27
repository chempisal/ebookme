/**
 * Google Sheets Cloud Sync Engine
 * Enables multi-device real-time sync and cloud database storage via Google Sheets & Apps Script.
 */

class GoogleSheetCloudSync {
    constructor() {
        this.scriptUrl = localStorage.getItem('kb_gapps_script_url') || '';
        this.sheetId = localStorage.getItem('kb_gsheet_id') || '';
        this.lastSyncTime = localStorage.getItem('kb_last_sync_time') || null;
        this.isSyncing = false;
    }

    isConnected() {
        return !!(this.scriptUrl && this.scriptUrl.startsWith('https://script.google.com/'));
    }

    setScriptUrl(url) {
        this.scriptUrl = (url || '').trim();
        if (this.scriptUrl) {
            localStorage.setItem('kb_gapps_script_url', this.scriptUrl);
        } else {
            localStorage.removeItem('kb_gapps_script_url');
        }
    }

    setSheetId(id) {
        this.sheetId = (id || '').trim();
        if (this.sheetId) {
            localStorage.setItem('kb_gsheet_id', this.sheetId);
        } else {
            localStorage.removeItem('kb_gsheet_id');
        }
    }

    disconnect() {
        this.scriptUrl = '';
        this.sheetId = '';
        this.lastSyncTime = null;
        localStorage.removeItem('kb_gapps_script_url');
        localStorage.removeItem('kb_gsheet_id');
        localStorage.removeItem('kb_last_sync_time');
    }

    /**
     * Fetch all books from Google Sheets API
     */
    async fetchBooksFromSheet() {
        if (!this.isConnected()) {
            throw new Error('Google Apps Script URL មិនទាន់ត្រូវបានកំណត់');
        }

        const fetchUrl = `${this.scriptUrl}?action=getBooks&t=${Date.now()}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);

        try {
            const response = await fetch(fetchUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timer);

            if (!response.ok) {
                throw new Error(`HTTP Error ${response.status}`);
            }

            const data = await response.json();
            if (data && data.success && Array.isArray(data.books)) {
                this.updateLastSyncTime();
                return data.books;
            } else if (Array.isArray(data)) {
                this.updateLastSyncTime();
                return data;
            } else {
                throw new Error(data.message || 'ទម្រង់ទិន្នន័យពី Google Sheet មិនត្រឹមត្រូវ');
            }
        } catch (err) {
            clearTimeout(timer);
            console.error('Fetch Books from Sheet Error:', err);
            throw err;
        }
    }

    /**
     * Save/Update a single book to Google Sheets
     */
    async saveBookToSheet(book) {
        if (!this.isConnected()) return false;

        const payload = {
            action: 'saveBook',
            book: {
                id: book.id,
                title: book.title,
                titleEn: book.titleEn || '',
                author: book.author || '',
                category: book.category || '',
                description: book.description || '',
                coverImage: book.coverImage || '',
                totalPages: book.totalPages || 1,
                fileSize: book.fileSize || 0,
                fileName: book.fileName || 'book.pdf',
                language: book.language || 'ខ្មែរ (Khmer)',
                publishedYear: book.publishedYear || new Date().getFullYear(),
                tags: Array.isArray(book.tags) ? book.tags.join(', ') : (book.tags || ''),
                rating: book.rating || 5.0,
                readsCount: book.readsCount || 0,
                createdAt: book.createdAt || Date.now()
            }
        };

        try {
            await fetch(this.scriptUrl, {
                method: 'POST',
                mode: 'no-cors', // Apps Script web app standard redirect
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            this.updateLastSyncTime();
            return true;
        } catch (err) {
            console.warn('Could not save book to Google Sheet:', err);
            return false;
        }
    }

    /**
     * Delete book from Google Sheets
     */
    async deleteBookFromSheet(bookId) {
        if (!this.isConnected()) return false;

        const payload = {
            action: 'deleteBook',
            bookId: bookId
        };

        try {
            await fetch(this.scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            this.updateLastSyncTime();
            return true;
        } catch (err) {
            console.warn('Could not delete book from Google Sheet:', err);
            return false;
        }
    }

    /**
     * Upload all local IndexedDB books to Google Sheets in batch
     */
    async syncAllToSheet() {
        if (!this.isConnected()) {
            throw new Error('Google Apps Script URL មិនទាន់ត្រូវបានកំណត់');
        }

        const localBooks = await window.bookDB.getAllBooks();
        if (localBooks.length === 0) {
            throw new Error('មិនមានសៀវភៅក្នុងម៉ាស៊ីនដើម្បី Sync ឡើងទៅ Cloud ទេ');
        }

        const payload = {
            action: 'syncAllBooks',
            books: localBooks.map(b => ({
                id: b.id,
                title: b.title,
                titleEn: b.titleEn || '',
                author: b.author || '',
                category: b.category || '',
                description: b.description || '',
                coverImage: b.coverImage || '',
                totalPages: b.totalPages || 1,
                fileSize: b.fileSize || 0,
                fileName: b.fileName || 'book.pdf',
                language: b.language || 'ខ្មែរ (Khmer)',
                publishedYear: b.publishedYear || new Date().getFullYear(),
                tags: Array.isArray(b.tags) ? b.tags.join(', ') : (b.tags || ''),
                rating: b.rating || 5.0,
                readsCount: b.readsCount || 0,
                createdAt: b.createdAt || Date.now()
            }))
        };

        await fetch(this.scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        this.updateLastSyncTime();
        return localBooks.length;
    }

    /**
     * Download all books from Google Sheet and merge into local IndexedDB
     */
    async syncAllFromSheet() {
        const cloudBooks = await this.fetchBooksFromSheet();
        if (!cloudBooks || cloudBooks.length === 0) {
            return 0;
        }

        let importedCount = 0;
        for (const b of cloudBooks) {
            if (!b.id || !b.title) continue;

            const existing = await window.bookDB.getBookById(b.id);
            const bookRecord = {
                id: b.id,
                title: b.title,
                titleEn: b.titleEn || '',
                author: b.author || 'អនាមិក',
                category: b.category || 'ទូទៅ',
                description: b.description || '',
                coverImage: b.coverImage || window.generateArtisticCover(b.title, b.author, '#4f46e5', '#7c3aed', '📖'),
                pdfData: existing ? existing.pdfData : (b.pdfData || window.createSamplePDFBlob(b.title, b.author, b.category, [{ heading: 'Chapter 1', paragraphs: [b.description || 'Welcome to this book.'] }])),
                totalPages: parseInt(b.totalPages, 10) || (existing ? existing.totalPages : 1),
                fileSize: parseInt(b.fileSize, 10) || (existing ? existing.fileSize : 0),
                fileName: b.fileName || `${b.title}.pdf`,
                language: b.language || 'ខ្មែរ (Khmer)',
                publishedYear: parseInt(b.publishedYear, 10) || new Date().getFullYear(),
                tags: typeof b.tags === 'string' ? b.tags.split(',').map(t => t.trim()).filter(Boolean) : (b.tags || []),
                rating: parseFloat(b.rating) || 5.0,
                readsCount: parseInt(b.readsCount, 10) || 0,
                createdAt: parseInt(b.createdAt, 10) || Date.now()
            };

            await window.bookDB.saveBook(bookRecord);
            importedCount++;
        }

        this.updateLastSyncTime();
        return importedCount;
    }

    updateLastSyncTime() {
        this.lastSyncTime = new Date().toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });
        localStorage.setItem('kb_last_sync_time', this.lastSyncTime);
        const label = document.getElementById('cloud-last-sync-label');
        if (label) label.textContent = `Sync ចុងក្រោយ: ${this.lastSyncTime}`;
    }

    /**
     * Generate the complete Google Apps Script ready-to-copy code
     */
    getGoogleAppsScriptCode() {
        return `/**
 * Google Apps Script for Bookstore Cloud Database API
 * Follow instructions to deploy as Web App (Anyone can access)
 */

function doGet(e) {
  var action = e.parameter.action || 'getBooks';
  var sheet = getOrCreateBooksSheet();
  
  if (action === 'getBooks') {
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return jsonResponse({ success: true, books: [] });
    }
    
    var headers = data[0];
    var books = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var book = {};
      for (var j = 0; j < headers.length; j++) {
        book[headers[j]] = row[j];
      }
      books.push(book);
    }
    
    return jsonResponse({ success: true, count: books.length, books: books });
  }
  
  return jsonResponse({ success: false, message: 'Invalid action' });
}

function doPost(e) {
  try {
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    var sheet = getOrCreateBooksSheet();
    
    if (action === 'saveBook') {
      var b = contents.book;
      saveOrUpdateBook(sheet, b);
      return jsonResponse({ success: true, message: 'Book saved successfully' });
    }
    
    if (action === 'deleteBook') {
      deleteBookById(sheet, contents.bookId);
      return jsonResponse({ success: true, message: 'Book deleted successfully' });
    }
    
    if (action === 'syncAllBooks') {
      var books = contents.books || [];
      for (var i = 0; i < books.length; i++) {
        saveOrUpdateBook(sheet, books[i]);
      }
      return jsonResponse({ success: true, message: 'All books synced', count: books.length });
    }
    
    return jsonResponse({ success: false, message: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function getOrCreateBooksSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Books');
  if (!sheet) {
    sheet = ss.insertSheet('Books');
    var headers = ['id', 'title', 'titleEn', 'author', 'category', 'description', 'coverImage', 'totalPages', 'fileSize', 'fileName', 'language', 'publishedYear', 'tags', 'rating', 'readsCount', 'createdAt'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function saveOrUpdateBook(sheet, b) {
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == b.id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  var rowData = [
    b.id || '',
    b.title || '',
    b.titleEn || '',
    b.author || '',
    b.category || '',
    b.description || '',
    b.coverImage || '',
    b.totalPages || 1,
    b.fileSize || 0,
    b.fileName || 'book.pdf',
    b.language || 'ខ្មែរ (Khmer)',
    b.publishedYear || 2026,
    b.tags || '',
    b.rating || 5.0,
    b.readsCount || 0,
    b.createdAt || new Date().getTime()
  ];
  
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

function deleteBookById(sheet, bookId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == bookId) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;
    }
}

window.cloudSheet = new GoogleSheetCloudSync();
