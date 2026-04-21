import base64
import gzip

import db

import dotenv

dotenv.load_dotenv()


def get_text(event):
    body = event.get("body")
    if not body:
        return ""

    is_base64 = event.get("isBase64Encoded", False)

    # 1. Декодируем base64, если нужно
    raw_data = base64.b64decode(body) if is_base64 else body.encode("utf-8")

    # 2. Проверяем заголовок Content-Encoding
    headers = event.get("headers", {})
    content_encoding = headers.get("content-encoding", "")

    if "gzip" in content_encoding:
        try:
            raw_data = gzip.decompress(raw_data)
        except gzip.BadGzipFile:
            return ""

    # 3. Декодируем текст
    return raw_data.decode("utf-8")


def handler(event, context):
    params = event["queryStringParameters"] or {}
    print(event)

    b = params.get("b")
    i = params.get("i")
    text = get_text(event)

    if b:
        b = int(b)
        if b < 0:
            res = db.delete_book(abs(b))
        elif i:
            res = db.translate_book(b, int(i))
        elif text:
            res = db.edit_book(b, text)
        else:
            res = db.load_book(b)
    elif text:
        res = db.create_book(text)
    else:
        res = db.get_books()

    return {"statusCode": 200, "body": res}


if __name__ == '__main__':
    print(handler({
        # 'httpMethod': 'POST',
        'httpMethod': 'GET',
        # 'queryStringParameters': {'b': -4},
        'queryStringParameters': {'b': 27, 'i': 88},
        # 'queryStringParameters': {},
        # 'body': base64.b64encode('text'.encode('utf-8')),
        # 'isBase64Encoded': True
    }, None))
