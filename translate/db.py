from time import sleep

import ydb
import ydb.iam
import re

import os

from utils import translate, get_title, get_ij

import dotenv

dotenv.load_dotenv()

driver = ydb.Driver(
    endpoint=os.getenv("YDB_ENDPOINT"),
    database=os.getenv("YDB_DATABASE"),
    credentials=ydb.AuthTokenCredentials(os.getenv('IAM_TOKEN')),
    # credentials=ydb.iam.MetadataUrlCredentials(),
)

driver.wait(fail_fast=True, timeout=50)

pool = ydb.SessionPool(driver)

settings = ydb.BaseRequestSettings().with_timeout(30).with_operation_timeout(20)


def execute(yql, params=None):
    def wrapper(session):
        try:
            if params:
                query = session.prepare(yql)
                res = session.transaction().execute(
                    query,
                    params,
                    commit_tx=True,
                    settings=settings
                )
            else:
                res = session.transaction().execute(
                    yql,
                    commit_tx=True,
                    settings=settings
                )
            return res[0].rows if len(res) else []
        except Exception as e:
            print(e)
            return []

    print(yql)
    return pool.retry_operation_sync(wrapper)


def get_books():
    print('get_books')
    return execute("SELECT id, title FROM rules;")


def delete_book(b):
    print('delete_book:', b)
    execute(f"DELETE FROM translates WHERE b=={b};")
    return execute(f"DELETE FROM rules WHERE id=={b};")


def create_book(text):
    print('create_book:', len(text))
    texts = re.split(r"\s*\n+\s*", text)
    texts = [t for t in texts if t]

    title = get_title(texts[0])
    res = execute(f'INSERT INTO rules (title) VALUES ("{title}") RETURNING id;')
    b = res[0]["id"]

    query = '''
        DECLARE $data AS List<Struct<b:Uint64, i:Uint32, en:Utf8>>;
        INSERT INTO translates (b, i, en)
        SELECT b, i, en FROM AS_TABLE($data) AS d
    '''
    execute(query, {'$data': [
        {'b': b, 'i': i, 'en': en}
        for i, en in enumerate(texts)
    ]})
    return {'b': b}


def load_book(b):
    print('load_book:', b)
    return execute(f"SELECT ru, en FROM translates WHERE b=={b} and i < 100 ORDER BY i;")


def edit_book(b, text):
    print('edit_book:', b)
    book = execute(f"SELECT ru, en FROM translates WHERE b=={b} ORDER BY i;")
    for i, ru in enumerate(text.split("\n")):
        book[i]["ru"] = ru
    execute(f"DELETE FROM translates WHERE b={b};")
    query = '''
        DECLARE $data AS List<Struct<b:Uint64, i:Uint32, ru:Utf8, en:Utf8>>;
        INSERT INTO translates (b, i, ru, en)
        SELECT b, i, ru, en FROM AS_TABLE($data) AS d
    '''
    return execute(query, {'$data': [
        {'b': b, 'i': i, 'ru': q['ru'], 'en': q['en']}
        for i, q in enumerate(book)
    ]})


def translate_book(b, i, d=5):
    print('translate_book:', b, i)

    t = execute(f"SELECT id, i, en FROM translates WHERE b=={b} and i>={i - d} and i<={i + d} and ru is null;")
    if not t or not translate(t):
        return {}

    query = '''
        DECLARE $updates AS List<Struct<id: Int64, ru: Utf8>>;
        UPDATE translates ON
        SELECT id, ru
        FROM AS_TABLE($updates) AS u;
    '''
    execute(query, {'$updates': [{'id': q['id'], 'ru': q['ru']} for q in t]})
    return {q['i']: q["ru"] for q in t}
