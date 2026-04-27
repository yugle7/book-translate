const API_ENDPOINT = "https://d5ds1trsppqs2rog97qd.cmxivbes.apigw.yandexcloud.net";

const mainPage = document.getElementById("main");
const bookPage = document.getElementById("book");
const uploadButton = document.getElementById("upload");
const fileInput = document.getElementById("file");
const chapterPage = document.getElementById("chapter");

const toMainButton = document.getElementById("to-main");
const toBookButton = document.getElementById("to-book");
const toMainRoundButton = document.getElementById("to-main-round");
const toBookRoundButton = document.getElementById("to-book-round");

const title = document.getElementById("title");
const books = document.getElementById("books");
const chapters = document.getElementById("chapters");
const settings = document.getElementById("settings");

const erase = document.getElementById("erase");
const download = document.getElementById("download");

const rules = document.getElementById("rules");
const words = document.getElementById("words");
const model = document.getElementById("model");

let toLeftButton = document.getElementById("to-left");
let toRightButton = document.getElementById("to-right");

const bookGutter = document.getElementById("book-gutter");
const chapterGutter = document.getElementById("chapter-gutter");

// состояние

let page = mainPage;

let book = null;
let chapter = null;
let paragraph = null;

// прогресс

let isTranslating = false;
let gutter = null;
let isDragging = false;
let wasDragging = false;
let startX = 0;
let startLeftWith = 0;
let clickTimeout = null;

const minWidth = 150;
const maxWidth = window.innerWidth - 150;

// добавление элементов

const addTranslates = async () => {
    console.log('addTranslates');

    if (paragraph.textContent || isTranslating || chapter.id == null) return;
    isTranslating = true;

    const translates = await getTranslates();
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
    const b = document.createElement('li')
    if (title) {
        b.innerText = title;
    }
    b.id = id;
    b.onclick = toBookPage;
    books.appendChild(b);
}

const removeBook = () => {
    const b = document.getElementById(book.id)
    b.remove()
    book = null;
}

const addParagraph = (text, i) => {
    const p = document.createElement("p");
    p.textContent = text;
    if (text) {
        if (text[0] === '#') p.classList.add("header");
        if (i != null) {
            // p.oninput = inputParagraph;
            p.onblur = blurParagraph
        }
    }

    const div = document.createElement('div')
    div.appendChild(p);

    if (i == null) {
        div.classList.add('right');
    } else {
        p.id = i;
        div.classList.add('left');
        div.onclick = handleParagraphClick;
    }
    chapterPage.appendChild(div);
}


bookGutter.onmousedown = handleMouseDown;
chapterGutter.onmousedown = handleMouseDown;

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
        addParagraph(p.left, p.i)
        addParagraph(p.right)
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
    title.innerText = book.title || '';
    choseAction();

    if ("chapters" in book)
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

    settings.rules.style.height = "auto";
    settings.rules.value = book.rules || "";
    settings.rules.style.height = settings.rules.scrollHeight + "px";

    settings.words.value = book.words && Object.entries(JSON.parse(book.words)).map(([en, ru]) => `${en} = ${ru}`).join('\n');
    settings.words.style.height = "auto";
    settings.words.style.height = settings.words.scrollHeight + "px";
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
    element.contentEditable = "plaintext-only";
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

const toLeftParagraph = (e) => {
    const right = e.currentTarget.parentElement;
    console.log(right)
    const left = right.previousElementSibling;
    right.style.display = 'none';
    left.style.display = 'inherit';
    left.appendChild(toRightButton);
}

const toRightParagraph = (e) => {
    const left = e.currentTarget.parentElement;
    console.log(left)
    const right = left.nextElementSibling;
    left.style.display = 'none';
    right.style.display = 'inherit';
    const back = toLeftButton.cloneNode(true);
    back.onclick = toLeftParagraph;
    right.appendChild(back);
}


const handleParagraphClick = async (e) => {
    if (isDragging) return;
    e.preventDefault();

    const div = e.currentTarget;

    const p = div.firstElementChild;
    if (p.classList.contains("editable")) return;

    console.log('handleParagraphClick:', p.id)
    div.appendChild(toRightButton);

    if (paragraph) {
        paragraph.classList.remove("editable");
        paragraph.contentEditable = false;
        paragraph.onkeydown = null;
    }
    paragraph = p;
    await addTranslates();
    paragraph.onkeydown = handleKeydown;
    makeEditable(paragraph, e.clientX, e.clientY);
}

function handleMouseDown(e) {
    gutter = e.target;
    isDragging = true;
    wasDragging = false;
    gutter.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    startX = e.clientX;
    startLeftWith = page.firstElementChild.getBoundingClientRect().width;
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

    gutter.style.left = leftWidth + 'px';
    page.style.gridTemplateColumns = `${leftWidth}px 1fr`;
}

function handleMouseUp() {
    if (isDragging && gutter) {
        isDragging = false;
        gutter.classList.remove("dragging");
        document.body.style.cursor = "";
        gutter = null;
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

uploadButton.onclick = () => fileInput.click();
fileInput.onchange = handleChange;

document.onmousemove = handleMouseMove;
document.onmouseup = handleMouseUp;
document.onmouseleave = handleMouseUp;

toRightButton.onclick = toRightParagraph;
toLeftButton.onclick = toLeftParagraph;

erase.onclick = async () => {
    await deleteBook();
    toMainPage();
}
download.onclick = async () => {
    const res = await getTranslation()
    if (res) window.open(res['link'], '_blank');
}

const toMainPage = () => {
    console.log('toMainPage');

    mainPage.classList.remove("hidden");
    bookPage.classList.add("hidden");
}

toMainRoundButton.onclick = toMainButton.onclick = toMainPage;

toBookRoundButton.onclick = toBookButton.onclick = () => {
    page = bookPage;
    console.log('backToBook');

    bookPage.classList.remove("hidden");
    chapterPage.classList.add("hidden");
};

// chapterPage.querySelector('div').onmousedown = handleMouseDown;

rules.addEventListener("input", resize);
words.addEventListener("input", resize);

// отправка и получение данных

const loadBook = async () => {
    console.log('loadBook:', book.id);

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("book_id", book.id)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    book = await response.json();
}


const loadChapter = async () => {
    console.log('loadChapter:', chapter.id);

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("chapter_id", chapter.id)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    chapter.paragraphs = await response.json();
}


const getBooks = async () => {
    console.log('getBooks')
    const response = await fetch(API_ENDPOINT);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
};

const deleteBook = async () => {
    console.log('deleteBook')
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("book_id", '-' + book.id)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    removeBook();
};

const createBook = async (text) => {
    console.log('createBook:', text.slice(0, 16));
    const url = new URL(API_ENDPOINT);

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
    addBook(book);
};


const getTranslates = async () => {
    console.log('getTranslates:', paragraph.id)

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("i", paragraph.id);
    url.searchParams.set("chapter_id", chapter.id);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();
};

const getTranslation = async () => {
    console.log('getTranslation:', book.id)

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("book_id", '+' + book.id);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();
};


// изначальная загрузка

getBooks()
    .then(books => books.forEach(addBook))
    .catch(error => console.error(error));


// заглушки для сервера

// const _loadChapter = async () => {
//     console.log('loadChapter:', chapter.id);
//     chapter = {
//         id: chapter.id,
//         translates: [
//             {id: 101, ru: "", en: "some text"},
//             {id: 102, ru: "", en: "text"},
//             {id: 103, ru: "", en: "any text"},
//             {id: 104, ru: "уже переведено", en: "it's text"},
//             {id: 105, ru: "", en: "text again"},
//         ]
//     }
// }
//
// const _createBook = async (text) => {
//     console.log('createBook:', text.slice(0, 16));
//     book = {
//         id: 3,
//         title: "new book"
//     }
// }
//
// const _getTranslates = async () => {
//     return {"101": "перевод", "102": "еще перевод"}
// }
//
// const _getBooks = async () => {
//     console.log('getBooks:')
//     return [{id: 1, title: 'first book'}, {id: 2, title: 'second book'}]
// };
//
// const _loadBook = async () => {
//     console.log('loadBook()', book.id);
//
//     book.title = 'title';
//     book.chapters = [{id: 11, title: 'one'}, {id: 12, title: 'two'}, {id: 13, title: 'three'}]
//
//     book.model = 'gpt4';
//     book.rules = 'правила';
//     book.words = {'word': 'слово', 'excel': 'excel'}
// }

// прокрутка

function checkScroll() {
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    if (scrollY > 50) {
        toMainButton.classList.remove('hided');
        toBookButton.classList.remove('hided');
    } else {
        toMainButton.classList.add('hided');
        toBookButton.classList.add('hided');
    }
}

window.addEventListener('scroll', checkScroll);

// автосохранение

const SAVE_DELAY_MS = 800;

let saveTimeout = null;
let abortController = null;


async function saveToServer(update) {
    if (abortController) abortController.abort();
    console.log('saveToServer:', update);

    abortController = new AbortController();
    const signal = abortController.signal;

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(update)
        });

        if (!response.ok) {
            console.error(`saveToServer: HTTP ${response.status}`);
            return false;
        }

        await response.json();
        return true;

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('saveToServer cancelled');
            return false;
        }
        console.error('saveToServer:', error);
        return false;

    } finally {
        if (abortController && abortController.signal === signal) {
            abortController = null;
        }
    }
}

const inputAutoSave = (update) => {
    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        await saveToServer(update);
        saveTimeout = null;
    }, SAVE_DELAY_MS);
}

const blurAutoSave = async (update) => {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    await saveToServer(update);
}

const choseAction = () => {
    if (title.innerText.trim()) {
        download.style.display = 'inline';
        erase.style.display = 'none';
    } else {
        download.style.display = 'none';
        erase.style.display = 'inline';
    }
}

title.oninput = choseAction;
// title.addEventListener('input', async () => {
//     if (book.title !== title.innerText.trim()) {
//         document.getElementById(book.id).innerText = book.title = title.innerText.trim();
//
//         inputAutoSave({
//             book_id: book.id,
//             title: book.title
//         });
//     }
// });


title.addEventListener('blur', async () => {
    if (book.title !== title.innerText.trim()) {
        document.getElementById(book.id).innerText = book.title = title.innerText.trim();

        await blurAutoSave({
            book_id: book.id,
            title: book.title
        });
    }
});


words.addEventListener('blur', async () => {
    await blurAutoSave({
        book_id: book.id,
        words: words.value
    });
});

rules.addEventListener('blur', async () => {
    await blurAutoSave({
        book_id: book.id,
        rules: rules.value
    });
});

model.addEventListener('blur', async () => {
    await blurAutoSave({
        book_id: book.id,
        model: model.value
    });
});

// const inputParagraph = (e) => {
//     const p = e.currentTarget;
//
//     inputAutoSave({
//         chapter_id: chapter.id,
//         i: p.id,
//         ru: p.innerText
//     });
// };

const blurParagraph = async (e) => {
    const p = e.currentTarget;

    if (p.innerText.startsWith('#')) {
        p.classList.add('header');
    } else {
        p.classList.remove('header');
    }
    await blurAutoSave({
        chapter_id: chapter.id,
        i: p.id,
        ru: p.innerText
    });
};



