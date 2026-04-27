import base64
import gzip
import json

import db

import dotenv

from utils import ids_to_str

dotenv.load_dotenv()


def _get_text(event):
    return '''# Preface
The text contains many clues: obvious clues, not-so-obvious clues, truly obscure hints which I was shocked to see some readers successfully decode, and massive evidence left out in plain sight. This is a rationalist story; its mysteries are solvable, and meant to be solved.
The pacing of the story is that of serial fiction, i.e., that of a TV show running for a predetermined number of seasons, whose episodes are individually plotted but with an overall arc building to a final conclusion.
All science mentioned is real science. But please keep in mind that, beyond the realm of science, the views of the characters may not be those of the author. Not everything the protagonist does is a lesson in wisdom, and advice offered by darker characters may be untrustworthy or dangerously double-edged.
'''


def get_data(event) -> dict:
    body = event.get("body")
    return json.loads(body) if body else {}


def get_text(event):
    body = event.get("body")
    if not body:
        return ""

    is_base64 = event.get("isBase64Encoded", False)

    # 1. Декодируем base64, если нужно
    try:
        text = base64.b64decode(body) if is_base64 else body.encode()
    except Exception as e:
        print(e)
        return ""

    # 2. Проверяем заголовок Content-Encoding
    try:
        text = gzip.decompress(text)
    except gzip.BadGzipFile as e:
        print(e)
        return ""

    # 3. Декодируем текст
    try:
        return text.decode("utf-8")
    except UnicodeDecodeError as e:
        print(e)
        return ""


def handler(event, context):
    print(event)

    method = event['httpMethod']
    res = {}

    if method == 'POST':
        headers = event.get("headers", {})
        content_type = headers.get("Content-Type")

        if 'text/plain' in content_type:
            text = get_text(event)
            res = db.create_book(text)

        elif 'application/json' in content_type:
            data = get_data(event)

            book_id = data.get('book_id')
            chapter_id = data.get('chapter_id')

            if book_id:
                res = db.update_book(data)
            elif chapter_id:
                res = db.update_paragraph(data)

    elif method == 'GET':
        params = event.get("queryStringParameters", {})

        book_id = params.get("book_id")
        chapter_id = params.get("chapter_id")

        if isinstance(book_id, str):
            k = book_id[0]
            if k == '-':
                res = db.delete_book(book_id[1:])
            elif k == '+':
                res = db.save_book(book_id[1:])
            else:
                res = db.load_book(book_id)

        elif isinstance(chapter_id, str):
            i = params.get("i")
            if i:
                res = db.get_translate(chapter_id, int(i))
            else:
                res = db.load_chapter(chapter_id)
        else:
            res = db.get_books()

    else:
        print("method:", method)

    # print(res)
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(ids_to_str(res))
    }


if __name__ == '__main__':
    print(handler({
        # 'httpMethod': 'POST',
        'httpMethod': 'GET',
        # 'queryStringParameters': {'b': -4},
        # 'queryStringParameters': {'b': 27, 'i': 82},
        # 'queryStringParameters': {},
        'queryStringParameters': {'book_id': '+1777054308952753879'},
        # 'queryStringParameters': {'chapter_id': 2202934346076896777},
        # 'queryStringParameters': {'chapter_id': 2202934346076896777, "i": "0", "left": "s"},
    }, None))
