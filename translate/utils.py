import re

import dotenv

dotenv.load_dotenv()


def id_getter():
    from time import time_ns
    i = time_ns()

    def get():
        nonlocal i
        i += 1
        return i

    return get


get_id = id_getter()


def parse(text):
    texts = re.split(r"\s*\n+\s*", text)
    texts = [t for t in texts if t]

    book_id = get_id()
    chapter_id = get_id()

    chapters = []
    paragraphs = []

    book = {"id": book_id}

    for i, right in enumerate(texts):
        if right.startswith('# '):
            chapter_id = get_id()
            chapters.append({
                "id": chapter_id,
                "book_id": book_id,
                "title": right.removeprefix('# ').strip()
            })
        elif not chapters:
            chapters.append({
                "id": chapter_id,
                "book_id": book_id,
                "title": right.strip('#').strip()
            })
        paragraphs.append({
            "book_id": book_id,
            "chapter_id": chapter_id,
            "i": i,
            "right": right
        })

    return book, chapters, paragraphs


def ids_to_str(src):
    if isinstance(src, dict):
        dst = {}
        for key, value in src.items():
            if isinstance(key, str) and (key == 'id' or key.endswith('_id')):
                dst[key] = str(value)
            else:
                dst[key] = ids_to_str(value)
        return dst
    elif isinstance(src, list):
        return [ids_to_str(q) for q in src]

    return src
