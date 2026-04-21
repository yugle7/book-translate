import ydb
import ydb.iam
import re
from time import time

import os

from translate.utils import get_title
from utils import translate

import dotenv

dotenv.load_dotenv()

driver = ydb.Driver(
    endpoint=os.getenv("YDB_ENDPOINT"),
    database=os.getenv("YDB_DATABASE"),
    credentials=ydb.AuthTokenCredentials(os.getenv('IAM_TOKEN')),
    # credentials=ydb.iam.MetadataUrlCredentials(),
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


def get_books():
    return execute("SELECT id, title FROM rules;")


def delete_book(b):
    execute(f"DELETE FROM translates WHERE b={b};")
    return execute(f"DELETE FROM rules WHERE id={b};")


def create_book(text):
    texts = re.split(r"\s*\n+\s*", text)
    texts = [t for t in texts if t]

    title = get_title(texts[0])
    res = execute(f'INSERT INTO rules (title) VALUES ("{title}") RETURNING id;')
    b = res[0]["id"]

    values = ",".join(f'({b}, {i}, "{en}")' for i, en in enumerate(texts))
    execute(f"INSERT INTO translates (b, i, en) VALUES {values};")

    return b


def load_book(b):
    return execute(f"SELECT ru, en FROM translates WHERE b={b} ORDER BY i;")


def edit_book(b, text):
    book = execute(f"SELECT ru, en FROM translates WHERE b={b} ORDER BY i;")
    for i, ru in enumerate(text.split("\n")):
        book[i]["ru"] = ru
    execute(f"DELETE FROM translates WHERE b={b};")
    values = ",".join(
        f'({b}, {i}, "{q['ru']}", "{q['en']}")' for i, q in enumerate(book)
    )
    execute(f"INSERT INTO translates (b, i, ru, en) VALUES {values};")
    return {}


def translate_book(b, i):
    book = execute(f"SELECT ru, en FROM translates WHERE b={b} ORDER BY i;")

    i, j = translate(book, i)
    execute(f"DELETE FROM translates WHERE b={b} and i >= {i} and i < {j}")

    values = ",".join(
        f'({b}, {k}, "{book[k]['ru']}", "{book[k]['en']}")' for k in range(i, j)
    )
    execute(f"INSERT INTO translates (b, i, ru, en) VALUES {values};")

    return {k: book[k]["ru"] for k in range(i, j)}
