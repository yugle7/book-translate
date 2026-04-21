const downloadScreen = document.getElementById("downloadScreen");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const grid = document.getElementById("resizableGrid");

let editable = null;
let translating = false;

uploadBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    if (!text) return;

    const texts = text.split(/\s*\n+\s*/).filter(t => t !== '');
    if (!texts) return;

    showEditor(texts);

    fileInput.value = "";
    await createBook(text);

    const title = getTitle(texts[0]);
    addBook({id: b, title});
});

const addBook = ({id, title}) => {
    const book = document.createElement('a')
    book.innerText = title;
    book.id = id;
    book.addEventListener('click', loadBook)
    downloadScreen.appendChild(book);
}

function showEditor(texts) {
    downloadScreen.classList.add("hidden");
    grid.classList.remove("hidden");

    let i = 0;
    texts.forEach((t) => {
        const left = document.createElement("p");
        left.classList.add("left");
        left.id = i++;
        left.addEventListener("click", translate);
        grid.appendChild(left);

        const gutter = document.createElement("div");
        grid.appendChild(gutter);

        const right = document.createElement("p");
        right.classList.add("right");
        right.textContent = t;
        grid.appendChild(right);
    });

    initEditor();
}

function viewEditor(book) {
    downloadScreen.classList.add("hidden");
    grid.classList.remove("hidden");

    let i = 0;
    book.forEach((t) => {
        const left = document.createElement("p");
        left.classList.add("left");
        left.id = i++;
        left.textContent = t.ru;
        left.addEventListener("click", translate);
        grid.appendChild(left);

        const gutter = document.createElement("div");
        grid.appendChild(gutter);

        const right = document.createElement("p");
        right.classList.add("right");
        right.textContent = t.en;
        grid.appendChild(right);
    });

    initEditor();
}

function initEditor() {
    let activeSplitter = null;
    let isDragging = false;
    let startX = 0;
    let startLeftWidth = 0;
    let clickTimeout = null;
    let wasDragging = false;

    function makeEditable(cell, clientX, clientY) {
        if (cell.classList.contains("editable")) {
            if (clientX != null) {
                const selection = window.getSelection();
                const range = document.caretRangeFromPoint(clientX, clientY);
                if (range) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            return;
        }

        cell.classList.add("editable");
        cell.contentEditable = true;
        cell.focus();

        if (clientX != null) {
            const selection = window.getSelection();
            const range = document.caretRangeFromPoint(clientX, clientY);
            if (range) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } else {
            const range = document.createRange();
            range.selectNodeContents(cell);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    function handleCellClick(e) {
        if (isDragging) return;
        if (e.target.tagName !== "P") return;
        if (e.target.classList.contains("editable")) return;
        if (editable) {
            editable.classList.remove("editable");
            editable.contentEditable = false;
            editable.removeEventListener("keydown", editableKeydown);
        }
        editable = e.target;
        editable.addEventListener("keydown", editableKeydown);
        makeEditable(editable, e.clientX, e.clientY);
    }

    function handleMouseDown(e) {
        activeSplitter = e.target;
        isDragging = true;
        wasDragging = false;
        activeSplitter.classList.add("dragging");
        document.body.style.cursor = "col-resize";

        const leftColRect = grid.querySelector(".left").getBoundingClientRect();
        startLeftWidth = leftColRect.width;
        startX = e.clientX;

        e.preventDefault();
    }

    function handleMouseMove(e) {
        if (!isDragging) return;

        wasDragging = true;
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
        }

        const deltaX = e.clientX - startX;
        let newLeftWidth = startLeftWidth + deltaX;

        const gridRect = grid.getBoundingClientRect();
        const minWidth = 150;
        const maxWidth = gridRect.width - 150;
        newLeftWidth = Math.min(maxWidth, Math.max(minWidth, newLeftWidth));

        grid.style.gridTemplateColumns = `${newLeftWidth}px 5px 1fr`;
    }

    function handleMouseUp() {
        if (isDragging && activeSplitter) {
            isDragging = false;
            activeSplitter.classList.remove("dragging");
            document.body.style.cursor = "";
            activeSplitter = null;
        }
    }

    const gutters = grid.querySelectorAll("div");
    gutters.forEach((gutter) => {
        gutter.addEventListener("mousedown", handleMouseDown);
    });

    grid.addEventListener("click", handleCellClick);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mouseleave", handleMouseUp);
}

const editableKeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertLineBreak");
    }
};

const saveBtn = document.getElementById("saveBtn");
saveBtn.addEventListener("click", () => {
    const leftCells = grid.querySelectorAll(".left");
    let text = "";
    leftCells.forEach((cell) => {
        text += cell.textContent + "\n\n";
    });

    const blob = new Blob([text], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translation.txt";
    a.click();
    URL.revokeObjectURL(url);
});

const backBtn = document.getElementById("backBtn");
backBtn.addEventListener("click", () => {
    grid.classList.add("hidden");
    downloadScreen.classList.remove("hidden");

    Array.from(grid.children)
        .slice(5)
        .forEach((q) => q.remove());
});

// отправка и получение данных
const endpoint = "https://functions.yandexcloud.net/d4e334h03qlqjf04arau";
let b = null;

const loadBook = async (e) => {
    b = e.currentTarget.id;

    console.log("loadBook:", b);
    const url = new URL(endpoint);
    url.searchParams.set("b", b)
    try {
        const response = await fetch(url);
        const book = await response.json();
        console.log('book:', book)
        viewEditor(book)
    } catch (error) {
        console.error("Error sending to server:", error);
    }
}

const getBooks = async () => {
    const url = new URL(endpoint);
    try {
        const response = await fetch(url);
        const books = await response.json();

        books.forEach(addBook);
    } catch (error) {
        console.error("Error sending to server:", error);
    }
}

getBooks();

function getTitle(text) {
    let words = text.split(/\s+/);

    if (words.length > 16) {
        for (let i = 0; i < words.length; i++) {
            if (words[i].endsWith('.')) {
                words = words.slice(0, i + 1);
                break;
            }
        }
    }

    if (words.length > 16) {
        for (let i = 0; i < words.length; i++) {
            if (i >= 3 && words[i].endsWith(',')) {
                words = words.slice(0, i + 1);
                break;
            }
        }
    }

    let title = words.slice(0, 16).join(' ');
    title = title.replace(/\W+/g, ' ');

    return title.split(/\s+/).map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}


const createBook = async (text) => {
    console.log("createBook:", text.length);
    const url = new URL(endpoint);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {"Content-Type": "text/plain"},
            body: text,
        });
        b = await response.text();
    } catch (error) {
        console.error("Error sending to server:", error);
    }
};

const translate = async (e) => {
    if (translating) {
        return;
    }
    translating = true;
    const i = e.currentTarget.id;
    console.log("translate:", i);

    const url = new URL(endpoint);
    url.searchParams.set("i", i);
    url.searchParams.set("b", b);
    try {
        const response = await fetch(url);
        console.log(url);
        console.log(response);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        console.log('data:', data);

        for (const [i, ru] of Object.entries(data)) {
            const p = document.getElementById(i);
            p.removeEventListener("click", translate);
            p.textContent = ru;
            console.log(p.textContent, p)
        }
    } catch (error) {
        console.error("Error sending to server:", error);
    } finally {
        translating = false;
    }
};
