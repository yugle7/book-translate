const api = "https://d5ds1trsppqs2rog97qd.cmxivbes.apigw.yandexcloud.net";

const mainPage = document.getElementById("main-page");
const bookPage = document.getElementById("book-page");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const chapterPage = document.getElementById("chapter-page");

const toMain = document.getElementById("to-main");
const toBook = document.getElementById("to-book");

const title = document.getElementById("title");
const books = document.getElementById("books");
const chapters = document.getElementById("chapters");
const settings = document.querySelector("form");

const rules = document.getElementById("rules");
const words = document.getElementById("words");

let page = mainPage;
const gutter = document.getElementById("gutter");

// состояние

let book = null;
let chapter = null;
let paragraph = null;

// прогресс

let isTranslating = false;
let activeGutter = null;
let isDragging = false;
let wasDragging = false;
let startX = 0;
let startLeftWith = 0;
let clickTimeout = null;

const minWidth = 150;
console.log('window.innerWidth:', window.innerWidth)
const maxWidth = window.innerWidth - 150;

// добавление элементов

const addTranslates = async () => {
    console.log('addTranslates()');

    if (paragraph.textContent || isTranslating || chapter.id == null) return;
    isTranslating = true;

    const translates = await getTranslates();
    console.log('translates:', translates)
    for (const [i, ru] of Object.entries(translates)) {
        const p = document.getElementById(i);
        p.textContent = ru;
        if (ru && ru[0] === '#') {
            p.classList.add('header')
        } else {
            p.classList.remove('header');
        }
    }
    isTranslating = false;
}

const addBook = ({id, title}) => {
    const book = document.createElement('li')
    book.innerText = title;
    book.id = id;
    book.onclick = toBookPage;
    books.appendChild(book);
}

const addParagraph = (text, i) => {
    const p = document.createElement("p");
    p.textContent = text;
    if (text && text[0] === '#') {
        p.classList.add("header");
    }

    if (i == null) {
        p.classList.add('right');
    } else {
        p.id = i;
        p.classList.add('left');
        p.onclick = handleParagraphClick;

    }
    chapterPage.appendChild(p);
}

const addGutter = () => {
    const gutter = document.createElement("div");
    gutter.onmousedown = handleMouseDown;
    chapterPage.appendChild(gutter);
}

gutter.onmousedown = handleMouseDown;

// переключение между страницами

const toChapterPage = async (e = null) => {
    page = chapterPage;
    console.log('toChapterPage');

    if (e != null) {
        e.preventDefault()
        chapter = {id: e.currentTarget.id};
    }

    Array.from(chapterPage.children)
        .slice(4)
        .forEach((q) => q.remove());

    bookPage.classList.add("hidden");
    chapterPage.classList.remove("hidden");

    await loadChapter();

    chapter.paragraphs.forEach(p => {
        addParagraph(p.ru, p.id)
        addGutter();
        addParagraph(p.en)
    });
}

const toBookPage = async (e = null) => {
    page = bookPage;
    console.log('toBookPage');
    if (e != null) {
        e.preventDefault()
        book = {id: e.currentTarget.id};
    }

    mainPage.classList.add("hidden");
    bookPage.classList.remove("hidden");
    chapterPage.classList.add("hidden");

    await loadBook();
    title.innerText = book.title;

    chapters.replaceChildren(
        ...book.chapters.map((c, i) => {
            const a = document.createElement('li');
            a.id = c.id;
            a.innerText = c.title;
            a.onclick = toChapterPage;
            return a;
        })
    );
    settings.model.value = book.model;
    settings.rules.value = book.rules;
    settings.rules.style.height = settings.rules.scrollHeight + "px";

    if (book.words) {
        settings.words.value = Object.entries(book.words).map(([en, ru]) => `${en} - ${ru}`).join('\n');
    }
    settings.words.style.height = settings.words.scrollHeight + "px";
}

const toMainPage = async () => {
    console.log('toMainPage');

    mainPage.classList.remove("hidden");
    bookPage.classList.add("hidden");
}

// редактирование

function makeEditable(element, clientX, clientY) {
    if (element.classList.contains("editable")) {
        if (clientX != null) {
            const position = document.caretPositionFromPoint(clientX, clientY);
            if (position) {
                const range = document.createRange();
                range.setStart(position.offsetNode, position.offset);
                range.collapse(true);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
        return;
    }

    element.classList.add("editable");
    element.contentEditable = true;
    element.focus();

    if (clientX != null) {
        const position = document.caretPositionFromPoint(clientX, clientY);
        if (position) {
            const range = document.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    } else {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // document.execCommand("insertLineBreak");
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement("br");
        range.insertNode(br);
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

// обработчики событий

const handleParagraphClick = async (e) => {
    if (isDragging) return;
    e.preventDefault();

    if (e.target.tagName !== "P") return;
    if (e.target.classList.contains("editable")) return;
    if (paragraph) {
        paragraph.classList.remove("editable");
        paragraph.contentEditable = false;
        paragraph.onkeydown = null;
    }
    paragraph = e.target;
    await addTranslates();
    paragraph.onkeydown = handleKeydown;
    makeEditable(paragraph, e.clientX, e.clientY);
}

function handleMouseDown(e) {
    activeGutter = e.target;
    isDragging = true;
    wasDragging = false;
    activeGutter.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    startX = e.clientX;
    startLeftWith = page.firstElementChild.getBoundingClientRect().width;
    console.log('startLeftWith:', startLeftWith)
    e.preventDefault();
}

function handleMouseMove(e) {
    if (!isDragging) return;

    wasDragging = true;
    if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
    }

    let leftWidth = startLeftWith + e.clientX - startX;
    leftWidth = Math.min(maxWidth, Math.max(minWidth, leftWidth));

    page.style.gridTemplateColumns = `${leftWidth}px 5px 1fr`;
}

function handleMouseUp() {
    if (isDragging && activeGutter) {
        isDragging = false;
        activeGutter.classList.remove("dragging");
        document.body.style.cursor = "";
        activeGutter = null;
    }
}

const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    if (!text) return;

    fileInput.value = "";

    await createBook(text);
    await toBookPage();
};

function resize() {
    if (this.offsetHeight <= this.scrollHeight) {
        this.style.height = this.scrollHeight + "px";
    }
}

uploadBtn.onclick = () => fileInput.click();
fileInput.onchange = handleChange;

document.onmousemove = handleMouseMove;
document.onmouseup = handleMouseUp;
document.onmouseleave = handleMouseUp;

toMain.onclick = toMainPage;
toBook.onclick = toBookPage;
chapterPage.querySelector('div').onmousedown = handleMouseDown;

rules.addEventListener("input", resize);
words.addEventListener("input", resize);

// отправка и получение данных

const loadBook = async () => {
    console.log('loadBook()', book.id);

    const url = new URL(api);
    url.searchParams.set("book_id", book.id)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    book = await response.json();
}


const loadChapter = async () => {
    console.log('loadChapter()', chapter.id);

    const url = new URL(api);
    url.searchParams.set("chapter_id", chapter.id)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    chapter.paragraphs = await response.json();
}


const getBooks = async () => {
    console.log('getBooks()')
    const response = await fetch(api);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
};

const createBook = async (text) => {
    console.log('createBook(text)');
    const url = new URL(api);

    const textBlob = new Blob([text], {type: 'text/plain; charset=utf-8'});
    const compressedStream = textBlob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Encoding': 'gzip'
        },
        body: compressedBlob
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    book = await response.json();
};


const getTranslates = async () => {
    console.log('getTranslates:', paragraph.id)

    const url = new URL(api);
    url.searchParams.set("i", paragraph.id);
    url.searchParams.set("chapter_id", chapter.id);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();
};


// изначальная загрузка

getBooks()
    .then(books => books.forEach(addBook))
    .catch(error => console.error(error));


// заглушки для сервера

const _loadChapter = async () => {
    console.log('loadChapter()', chapter.id);
    chapter = {
        id: chapter.id,
        translates: [
            {id: 101, ru: "", en: "some text"},
            {id: 102, ru: "", en: "text"},
            {id: 103, ru: "", en: "any text"},
            {id: 104, ru: "уже переведено", en: "it's text"},
            {id: 105, ru: "", en: "text again"},
        ]
    }
}

const _createBook = async (text) => {
    console.log('createBook(text)');
    book = {
        id: 3,
        title: "new book"
    }
}

const _getTranslates = async () => {
    return {"101": "перевод", "102": "еще перевод"}
}

const _getBooks = async () => {
    console.log('getBooks()')
    return [{id: 1, title: 'first book'}, {id: 2, title: 'second book'}]
};

const _loadBook = async () => {
    console.log('loadBook()', book.id);

    book.title = 'title';
    book.chapters = [{id: 11, title: 'one'}, {id: 12, title: 'two'}, {id: 13, title: 'three'}]

    book.model = 'gpt4';
    book.rules = 'правила';
    book.words = {'word': 'слово', 'excel': 'excel'}
}