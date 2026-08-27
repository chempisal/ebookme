/**
 * Sample Book Seed Data and PDF Generator
 * Generates valid multi-page PDF documents and seed books for instant exploration.
 */

// Helper to create a valid multi-page PDF Blob dynamically
function createSamplePDFBlob(title, author, category, pagesContent) {
    // Simple standard compliant PDF generator
    const objects = [];
    let objCount = 0;

    function addObj(content) {
        objCount++;
        objects.push({ id: objCount, content: content });
        return objCount;
    }

    // Obj 1: Catalog
    const catalogId = addObj(`<< /Type /Catalog /Pages 2 0 R >>`);
    
    // Page IDs will be populated
    const pageObjIds = [];
    const fontObjId = 4; // Reserve ID 4 for standard Font

    // Obj 2: Pages container (placeholder content updated later)
    const pagesContainerIndex = objects.length;
    addObj(``); // index 1 (id 2)

    // Obj 3: Outlines
    addObj(`<< /Type /Outlines /Count 0 >>`);

    // Obj 4: Font Helvetica
    addObj(`<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica-Bold >>`);
    // Obj 5: Font Times
    addObj(`<< /Type /Font /Subtype /Type1 /Name /F2 /BaseFont /Times-Roman >>`);

    // Create pages
    pagesContent.forEach((page, idx) => {
        // Stream text content
        const lines = [];
        lines.push(`q`);
        
        // Header background banner
        lines.push(`0.08 0.12 0.22 rg`);
        lines.push(`0 740 612 100 re f`);
        
        // Header text (White)
        lines.push(`1 1 1 rg`);
        lines.push(`BT /F1 20 Tf 40 790 Td (${escapePdfText(title)}) Tj ET`);
        lines.push(`BT /F2 12 Tf 40 765 Td (Author: ${escapePdfText(author)}  |  Category: ${escapePdfText(category)}  |  Page ${idx + 1} of ${pagesContent.length}) Tj ET`);
        
        // Page border/card
        lines.push(`0.92 0.94 0.98 rg`);
        lines.push(`30 40 552 680 re f`);
        lines.push(`0.75 0.8 0.9 RG 1.5 w`);
        lines.push(`30 40 552 680 re S`);

        // Subtitle / Chapter Heading
        lines.push(`0.1 0.2 0.4 rg`);
        lines.push(`BT /F1 16 Tf 50 680 Td (${escapePdfText(page.heading || `Chapter ${idx + 1}`)}) Tj ET`);

        // Decorative horizontal rule
        lines.push(`0.39 0.4 0.95 RG 2 w`);
        lines.push(`50 665 m 560 665 l S`);

        // Body text paragraphs
        lines.push(`0.15 0.18 0.22 rg`);
        let currentY = 635;
        (page.paragraphs || []).forEach(p => {
            lines.push(`BT /F2 12 Tf 50 ${currentY} Td (${escapePdfText(p)}) Tj ET`);
            currentY -= 24;
        });

        // Key Points box if exists
        if (page.keyPoints && page.keyPoints.length > 0) {
            currentY -= 15;
            lines.push(`0.9 0.93 1.0 rg`);
            lines.push(`50 ${currentY - (page.keyPoints.length * 20 + 25)} 510 ${page.keyPoints.length * 20 + 35} re f`);
            lines.push(`0.3 0.4 0.85 RG 1 w`);
            lines.push(`50 ${currentY - (page.keyPoints.length * 20 + 25)} 510 ${page.keyPoints.length * 20 + 35} re S`);

            lines.push(`0.15 0.25 0.6 rg`);
            lines.push(`BT /F1 11 Tf 65 ${currentY - 5} Td (KEY HIGHLIGHTS & SUMMARY:) Tj ET`);
            
            lines.push(`0.2 0.25 0.35 rg`);
            page.keyPoints.forEach((point, pIdx) => {
                lines.push(`BT /F2 10 Tf 70 ${currentY - 25 - (pIdx * 18)} Td (*  ${escapePdfText(point)}) Tj ET`);
            });
            currentY -= (page.keyPoints.length * 20 + 40);
        }

        // Footer
        lines.push(`0.5 0.55 0.6 rg`);
        lines.push(`BT /F2 9 Tf 50 55 Td (Digital e-Library Edition  -  Confidential & Educational Use  -  Page ${idx + 1}) Tj ET`);
        lines.push(`Q`);

        const streamContent = lines.join('\n');
        const streamLength = streamContent.length;

        // Content stream object
        const contentId = addObj(`<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`);

        // Page object
        const pageId = addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>`);
        pageObjIds.push(pageId);
    });

    // Update Obj 2 (Pages container)
    objects[1].content = `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`;

    // Assemble PDF
    let pdfString = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];

    objects.forEach(obj => {
        offsets.push(pdfString.length);
        pdfString += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
    });

    const xrefOffset = pdfString.length;
    pdfString += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(off => {
        pdfString += `${String(off).padStart(10, '0')} 00000 n \n`;
    });

    pdfString += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdfString], { type: 'application/pdf' });
}

function escapePdfText(text) {
    if (!text) return '';
    return text.replace(/\\/g, '\\\\')
               .replace(/\(/g, '\\(')
               .replace(/\)/g, '\\)');
}

// Generate an artistic SVG / Canvas Cover for each book
function generateArtisticCover(title, author, color1, color2, iconSymbol) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');

    // Gradient Background
    const gradient = ctx.createLinearGradient(0, 0, 400, 560);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 560);

    // Decorative geometric patterns
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(200, 180, 120, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(200, 180, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle Grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 40; i < 400; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 560);
        ctx.stroke();
    }

    // Top Badge / Library tag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(120, 30, 160, 28, 14);
    } else {
        ctx.rect(120, 30, 160, 28);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIGITAL EDITION', 200, 49);

    // Center Icon / Symbol
    ctx.font = '64px sans-serif';
    ctx.fillText(iconSymbol || '📖', 200, 195);

    // Title area
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Kantumruy Pro", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap title if long
    const words = title.split(' ');
    let line = '';
    let y = 350;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 340 && n > 0) {
            ctx.fillText(line, 200, y);
            line = words[n] + ' ';
            y += 32;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, 200, y);

    // Divider
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(160, y + 25, 80, 4);

    // Author
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '15px "Kantumruy Pro", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(author, 200, y + 55);

    // Bottom Badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 510, 400, 50);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('⭐ 4.9  |  PREMIUM PDF E-BOOK', 200, 540);

    return canvas.toDataURL('image/png');
}

// Sample books collection definition
const SAMPLE_BOOKS = [
    {
        id: 'sample_tum_teav',
        title: 'រឿងទុំទាវ (Tum Teav Classic)',
        titleEn: 'Tum Teav - Classic Khmer Romance',
        author: 'ភិក្ខុសោម (Ven. Botumthera Som)',
        category: 'អក្សរសិល្ប៍ (Literature)',
        description: 'រឿងប្រលោមលោកបុរាណខ្មែរដ៏ល្បីល្បាញបំផុតដែលរៀបរាប់អំពីដំណើររឿងស្នេហាដ៏រំជួលចិត្តរវាងទុំនិងទាវ និងការតស៊ូប្រឆាំងនឹងទំនៀមទម្លាប់បុរាណ។',
        language: 'ខ្មែរ (Khmer)',
        publishedYear: 1915,
        rating: 5.0,
        readsCount: 1420,
        tags: ['រឿងបុរាណ', 'ស្នេហា', 'អក្សរសិល្ប៍ខ្មែរ', 'ប្រវត្តិសាស្ត្រ'],
        color1: '#4f46e5',
        color2: '#7c3aed',
        icon: '📜',
        pages: [
            {
                heading: 'Chapter 1: The Origin of Tum & Teav',
                paragraphs: [
                    'Tum was a handsome young monk talented in singing Smot, traveling across provinces.',
                    'Teav was a breathtakingly beautiful young woman living in Tbong Khmum province with her mother.',
                    'Their paths crossed during a traditional merit-making festival where destiny brought them together.',
                    'The melody of Tum voice captured the hearts of everyone, especially Teav who fell in love deeply.'
                ],
                keyPoints: [
                    'Tum possesses supreme talent in traditional chanting and arts.',
                    'Teav represents unmatched beauty, grace, and inner strength.',
                    'Setting: Traditional Cambodian society in Longvek era.'
                ]
            },
            {
                heading: 'Chapter 2: The Oath of Eternal Love',
                paragraphs: [
                    'Despite immense social pressure and differences in status, Tum and Teav made a solemn vow.',
                    'They promised eternal loyalty to one another beneath the sacred moonlight.',
                    'However, clouds of impending tragedy began gathering as powerful figures noticed Teav.'
                ],
                keyPoints: [
                    'A promise of unwavering devotion that transcends social barriers.',
                    'Symbolism of Betel leaf and scarf exchange in Khmer courtship rituals.'
                ]
            },
            {
                heading: 'Chapter 3: The Tragedy and Moral Legacy',
                paragraphs: [
                    'Greed, authoritarian power, and forced marriage led to an unforgettable climax.',
                    'The story of Tum Teav remains an eternal beacon of freedom in choosing one true love.',
                    'It has been taught in generations of Cambodian schools as a masterwork of literature.'
                ],
                keyPoints: [
                    'Considered the Romeo and Juliet of Cambodian classical literature.',
                    'Rich poetic meter and profound reflections on human destiny.'
                ]
            }
        ]
    },
    {
        id: 'sample_ai_guide',
        title: 'មូលដ្ឋានគ្រឹះវិទ្យាសាស្ត្រកុំព្យូទ័រ និង AI',
        titleEn: 'Foundations of Computer Science & Modern AI',
        author: 'បណ្ឌិត សុខ វាសនា (Dr. Sok Veasna)',
        category: 'បច្ចេកវិទ្យា (Technology)',
        description: 'សៀវភៅណែនាំស៊ីជម្រៅអំពីគោលការណ៍កូដ ក្បួនដោះស្រាយ (Algorithms), Cloud Computing និងបច្ចេកវិទ្យាបញ្ញាសិប្បនិម្មិត (AI/Machine Learning) សម្រាប់យុវជនសម័យឌីជីថល។',
        language: 'ខ្មែរ / English',
        publishedYear: 2026,
        rating: 4.9,
        readsCount: 2310,
        tags: ['AI', 'Programming', 'Cloud', 'Algorithms', 'Tech'],
        color1: '#0284c7',
        color2: '#0f172a',
        icon: '💻',
        pages: [
            {
                heading: 'Chapter 1: The Digital Renaissance & AI Paradigm',
                paragraphs: [
                    'Artificial Intelligence has transformed from academic research into everyday superpower.',
                    'Neural networks and Transformer architectures now power autonomous agents and reasoning systems.',
                    'Understanding algorithms and data structures remains the core pillar of software mastery.',
                    'Every engineer must master computational thinking, efficiency analysis, and system architecture.'
                ],
                keyPoints: [
                    'LLMs and Multi-modal reasoning models reshaping productivity.',
                    'Big-O notation and clean architecture are timeless fundamentals.',
                    'Edge AI and Cloud computing working in high-efficiency synergy.'
                ]
            },
            {
                heading: 'Chapter 2: Modern Web & Full-Stack Architecture',
                paragraphs: [
                    'Modern web apps demand sub-millisecond response times, glassmorphic UI, and offline-first capabilities.',
                    'Client-side databases like IndexedDB enable desktop-class experiences inside modern browsers.',
                    'Scalable microservices and event-driven pipelines provide resilient backbones.'
                ],
                keyPoints: [
                    'IndexedDB delivers GBs of structured offline storage in browser.',
                    'Vanilla ES6+ and modern CSS deliver unmatched speed and lightness.',
                    'Reactive UI patterns keep users delighted.'
                ]
            },
            {
                heading: 'Chapter 3: Ethics and Future of Human-AI Collaboration',
                paragraphs: [
                    'AI does not replace human ingenuity; it amplifies our creative potential by 10x.',
                    'Responsible engineering requires rigorous security, transparency, and data privacy safeguards.',
                    'Continuous lifelong learning is the ultimate competitive advantage in tech.'
                ],
                keyPoints: [
                    'Human-in-the-loop validation creates trustworthy intelligent systems.',
                    'Security by design: Always validate inputs and encrypt sensitive storage.'
                ]
            }
        ]
    },
    {
        id: 'sample_business_mindset',
        title: 'សិល្បៈនៃការគិត និងដឹកនាំជីវិតឆ្ពោះទៅភាពជោគជ័យ',
        titleEn: 'The Art of Mindset & Leadership Mastery',
        author: 'ចាន់ វណ្ណារ៉ា (Chan Vannara)',
        category: 'ធុរកិច្ច (Business)',
        description: 'យុទ្ធសាស្ត្រអភិវឌ្ឍន៍ខ្លួន ការកសាងទម្លាប់ល្អៗ ជំនាញទំនាក់ទំនង ការគ្រប់គ្រងហិរញ្ញវត្ថុ និងផ្នត់គំនិតភាពជាអ្នកដឹកនាំក្នុងសតវត្សរ៍ទី២១។',
        language: 'ខ្មែរ (Khmer)',
        publishedYear: 2025,
        rating: 4.8,
        readsCount: 1890,
        tags: ['ភាពជាអ្នកដឹកនាំ', 'អភិវឌ្ឍន៍ខ្លួន', 'ទម្លាប់ជោគជ័យ', 'ហិរញ្ញវត្ថុ'],
        color1: '#059669',
        color2: '#064e3b',
        icon: '🚀',
        pages: [
            {
                heading: 'Chapter 1: The Power of Incremental Habits',
                paragraphs: [
                    'Success is not an overnight explosion; it is the compound interest of tiny daily decisions.',
                    'Improving by just 1 percent every day leads to a staggering 37x growth in a single year.',
                    'Focus on building your identity and systems rather than obsessing solely on distant goals.',
                    'Eliminate friction for good habits and create friction for unproductive distractions.'
                ],
                keyPoints: [
                    'Atomic habits compound over time into monumental achievements.',
                    'Consistency beats sporadic intense effort every single time.',
                    'Design your environment to make good choices effortless.'
                ]
            },
            {
                heading: 'Chapter 2: Financial Intelligence & Wealth Building',
                paragraphs: [
                    'True wealth is freedom of time, peace of mind, and ability to help others thrive.',
                    'Master the distinction between assets that put money in your pocket and liabilities that take it.',
                    'Live beneath your means, invest continuously in learning, and build diversified value streams.'
                ],
                keyPoints: [
                    'Prioritize investing in knowledge and high-yield skills first.',
                    'Emergency funds provide psychological resilience during uncertainties.'
                ]
            },
            {
                heading: 'Chapter 3: Empathetic Leadership and High Impact',
                paragraphs: [
                    'Great leaders do not create followers; they inspire and nurture more leaders.',
                    'Active listening, emotional intelligence, and radical transparency build unbreakable trust.',
                    'Give credit generously to your team and take accountability with humility.'
                ],
                keyPoints: [
                    'Empathy is the most potent leadership tool in the modern world.',
                    'Clear communication eliminates 90% of organizational friction.'
                ]
            }
        ]
    },
    {
        id: 'sample_khmer_history',
        title: 'ប្រវត្តិសាស្ត្រ និងរតនសម្បត្តិអារ្យធម៌អង្គរ',
        titleEn: 'History and Treasures of the Angkorian Civilization',
        author: 'សាស្ត្រាចារ្យ ហេង សម្បត្តិ (Prof. Heng Sambath)',
        category: 'ប្រវត្តិសាស្ត្រ (History)',
        description: 'ដំណើររឿងរ៉ាវប្រវត្តិសាស្ត្រដ៏រុងរឿងនៃចក្រភពអង្គរ ស្ថាបត្យកម្មប្រាសាទបុរាណ ប្រព័ន្ធធារាសាស្ត្រ និងកេរដំណែលវប្បធម៌ខ្មែរដែលពិភពលោកកោតសរសើរ។',
        language: 'ខ្មែរ (Khmer)',
        publishedYear: 2024,
        rating: 4.9,
        readsCount: 3120,
        tags: ['ប្រវត្តិសាស្ត្រ', 'អង្គរវត្ត', 'វប្បធម៌ខ្មែរ', 'ស្ថាបត្យកម្ម'],
        color1: '#d97706',
        color2: '#78350f',
        icon: '🏛️',
        pages: [
            {
                heading: 'Chapter 1: The Golden Age of Angkor',
                paragraphs: [
                    'The Khmer Empire between the 9th and 15th centuries was a zenith of Southeast Asian civilization.',
                    'Angkor Wat stands as the largest religious monument in the world, embodying astronomical precision.',
                    'Advanced hydraulic engineering with vast Barays enabled thriving agriculture and sustainable cities.'
                ],
                keyPoints: [
                    'Mastery of stone masonry and bas-relief storytelling carvings.',
                    'Harmonious blend of Hinduism and Mahayana Buddhism.',
                    'Complex city planning supporting over one million inhabitants.'
                ]
            },
            {
                heading: 'Chapter 2: Inscriptions and Cultural Treasures',
                paragraphs: [
                    'Ancient Sanskrit and Old Khmer inscriptions carved on temple doorframes preserve timeless wisdom.',
                    'Royal decrees, hospitals (Arogyasala), rest houses (Dharmasala), and trade routes spanned the empire.',
                    'The Bayon temple with its serene smiling faces of Avalokiteshvara represents divine compassion.'
                ],
                keyPoints: [
                    'Epigraphy provides priceless insights into governance, law, and daily life.',
                    'King Jayavarman VII built extensive infrastructure and public welfare hospitals.'
                ]
            }
        ]
    }
];

// Seeder function
async function seedInitialBooks() {
    try {
        const existingBooks = await window.bookDB.getAllBooks();
        if (existingBooks && existingBooks.length > 0) {
            console.log(`[BookDB] Library already populated with ${existingBooks.length} books.`);
            return;
        }

        console.log('[BookDB] First run: Seeding sample PDF books...');
        for (const bookInfo of SAMPLE_BOOKS) {
            const pdfBlob = createSamplePDFBlob(
                bookInfo.titleEn || bookInfo.title,
                bookInfo.author,
                bookInfo.category,
                bookInfo.pages
            );

            const coverDataUrl = generateArtisticCover(
                bookInfo.title,
                bookInfo.author,
                bookInfo.color1,
                bookInfo.color2,
                bookInfo.icon
            );

            const bookRecord = {
                id: bookInfo.id,
                title: bookInfo.title,
                titleEn: bookInfo.titleEn,
                author: bookInfo.author,
                category: bookInfo.category,
                description: bookInfo.description,
                coverImage: coverDataUrl,
                pdfData: pdfBlob,
                totalPages: bookInfo.pages.length,
                fileSize: pdfBlob.size,
                fileName: `${bookInfo.id}.pdf`,
                language: bookInfo.language,
                publishedYear: bookInfo.publishedYear,
                tags: bookInfo.tags,
                rating: bookInfo.rating,
                readsCount: bookInfo.readsCount,
                createdAt: Date.now() - Math.floor(Math.random() * 10000000)
            };

            await window.bookDB.saveBook(bookRecord);
        }

        console.log('[BookDB] Successfully seeded initial sample books.');
    } catch (err) {
        console.error('[BookDB] Failed to seed sample books:', err);
    }
}

window.seedInitialBooks = seedInitialBooks;
window.generateArtisticCover = generateArtisticCover;
window.createSamplePDFBlob = createSamplePDFBlob;
