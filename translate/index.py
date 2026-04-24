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


def get_text(event):
    body = event.get("body")
    if not body:
        return ""

    is_base64 = event.get("isBase64Encoded", False)

    # 1. Декодируем base64, если нужно
    try:
        raw_data = base64.b64decode(body) if is_base64 else body.encode()
    except Exception as e:
        print(e)
        return ""

    # 2. Проверяем заголовок Content-Encoding
    headers = event.get("headers", {})
    content_encoding = headers.get("content-encoding") or headers.get("Content-Encoding", "")

    if "gzip" in content_encoding:
        try:
            raw_data = gzip.decompress(raw_data)
        except gzip.BadGzipFile as e:
            print(e)
            return ""

    # 3. Декодируем текст
    try:
        return raw_data.decode("utf-8")
    except UnicodeDecodeError as e:
        print(e)
        return ""


def handler(event, context):
    print(event)

    method = event['httpMethod']

    if method == 'POST':
        text = _get_text(event)
        res = db.create_book(text)

    elif method == 'GET':
        params = event["queryStringParameters"] or {}

        book_id = params.get("book_id")
        chapter_id = params.get("chapter_id")

        if book_id:
            book_id = int(book_id)
            if book_id > 0:
                res = db.load_book(book_id)
            else:
                res = db.delete_book(abs(book_id))
        elif chapter_id:
            chapter_id = int(chapter_id)
            i = params.get("i")
            if i:
                i = int(i)
                ru = params.get("ru")

                if ru:
                    res = db.set_translate(chapter_id, i, ru)
                else:
                    res = db.get_translate(chapter_id, i)
            else:
                res = db.load_chapter(chapter_id)
        else:
            res = db.get_books()

    else:
        print("method:", method)
        res = {}

    print(res)
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
        # 'queryStringParameters': {'book_id': 489898406972149379},
        # 'queryStringParameters': {'chapter_id': 2202934346076896777},
        'queryStringParameters': {'chapter_id': 2202934346076896777, "i": "0", "ru": "s"},
    }, None))
