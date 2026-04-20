import os
import db
import hashlib
import json

import dotenv

dotenv.load_dotenv()


def handler(event, context):
    params = event["queryStringParameters"]

    book_id = params["book_id"]
    en = params["en"]
    ru = params["ru"]

    if book_id:
        if en and ru:
            res = db.save_book(book_id, en, ru)
        else:
            res = db.load_book(book_id)
    else:
        res = db.translate_book(en)

    return {"statusCode": 200, "body": res}
