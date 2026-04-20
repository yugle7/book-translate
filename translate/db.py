import ydb
import ydb.iam

from time import time

import os
import json

from utils import translate


import dotenv

dotenv.load_dotenv()

driver = ydb.Driver(
    endpoint=os.getenv("YDB_ENDPOINT"),
    database=os.getenv("YDB_DATABASE"),
    # credentials=ydb.AuthTokenCredentials(os.getenv('IAM_TOKEN')),
    credentials=ydb.iam.MetadataUrlCredentials(),
)

driver.wait(fail_fast=True, timeout=5)

pool = ydb.SessionPool(driver)

settings = ydb.BaseRequestSettings().with_timeout(3).with_operation_timeout(2)


def execute(yql):
    def wrapper(session):
        try:
            res = session.transaction().execute(yql, commit_tx=True, settings=settings)
            return res[0].rows if len(res) else []

        except Exception as e:
            print(e)
            return []

    print(yql)
    return pool.retry_operation_sync(wrapper)


def load_book(book_id):
    return execute(f"SELECT ru, en FROM books WHERE book_id={book_id};")


def save_book(book_id, translation):
    execute(f"DELETE FROM books WHERE book_id={book_id};")
    values = ",".join(f'({book_id}, "{q['ru']}", "{q['en']}")' for q in translation)
    execute(f"INSERT INTO books (book_id, ru, en) VALUES {values};")

    return {"ok": True}


def translate_book(en):
    book_id = int(time())

    ru = translate(en)

    values = ",".join(f'("{en}", "{ru}", {book_id})' for en, ru in zip(en, ru))
    execute(f"INSERT INTO books (en, ru, id) VALUES {values};")

    return {"ru": ru}
