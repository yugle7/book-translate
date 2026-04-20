import ydb
import ydb.iam
import re
from time import time

import os

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


def add_book(text):
    b = int(time())
    texts = re.split(r'\s*\n+\s*', text)
    texts = [t for t in texts if t]
    values = ",".join(f'({b}, {i}, "{en}")' for i, en in enumerate(texts))
    execute(f"INSERT INTO books (b, i, en) VALUES {values};")
    return b


def load_book(b):
    return execute(f"SELECT ru, en FROM books WHERE b={b} ORDER BY i;")


def edit_book(b, text):
    book = execute(f"SELECT ru, en FROM books WHERE b={b} ORDER BY i;")
    for i, ru in enumerate(text.split('\n')):
        book[i]['ru'] = ru
    execute(f"DELETE FROM books WHERE b={b};")
    values = ",".join(f'({b}, {i}, "{q['ru']}", "{q['en']}")' for i, q in enumerate(book))
    execute(f"INSERT INTO books (b, i, ru, en) VALUES {values};")
    return {}


def translate_book(b, i):
    book = execute(f"SELECT ru, en FROM books WHERE b={b} ORDER BY i;")
    j = i + 1
    while i and not book[i - 1]['ru']:
        i -= 1

    i, j = translate(book, i, j)
    execute(f'DELETE FROM books WHERE b={b} and i >= {i} and i < {j}')

    values = ",".join(f'({b}, {k}, "{book[k]['ru']}", "{book[k]['en']}")' for k in range(i, j))
    execute(f"INSERT INTO books (b, i, ru, en) VALUES {values};")

    return {k: book[k]['ru'] for k in range(i, j)}
