import base64
import os
import db
import hashlib
import json

import dotenv

dotenv.load_dotenv()


def handler(event, context):
    params = event["queryStringParameters"]
    print(event)

    b = params.get("b")
    i = params.get("i")
    text = None

    if event['httpMethod'] == 'POST':
        body = event.get('body')
        if event.get('isBase64Encoded'):
            text = base64.b64decode(body).decode('utf-8')

    if b:
        if i:
            res = db.translate_book(b, int(i))
        elif text:
            res = db.edit_book(b, text)
        else:
            res = db.load_book(b)
    else:
        res = db.add_book(text)

    return {"statusCode": 200, "body": res}
