import base64
import db

import dotenv

dotenv.load_dotenv()


def handler(event, context):
    params = event["queryStringParameters"] or {}
    print(event)

    b = params.get("b")
    i = params.get("i")
    text = None

    if event["httpMethod"] == "POST":
        body = event.get("body")
        if event.get("isBase64Encoded"):
            text = base64.b64decode(body).decode("utf-8")
            print(text)

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
        'queryStringParameters': {'b': 7, 'i': 3},
        # 'queryStringParameters': {},
        # 'body': base64.b64encode('text'.encode('utf-8')),
        # 'isBase64Encoded': True
    }, None))
