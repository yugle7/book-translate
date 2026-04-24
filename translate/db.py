import ydb
import ydb.iam

import os

from utils import translate, parse

from dotenv import load_dotenv

load_dotenv()

driver = ydb.Driver(
    endpoint=os.getenv("YDB_ENDPOINT"),
    database=os.getenv("YDB_DATABASE"),
    credentials=ydb.AuthTokenCredentials(os.getenv('IAM_TOKEN')),
    # credentials=ydb.iam.MetadataUrlCredentials(),
)

driver.wait(fail_fast=True, timeout=50)

pool = ydb.SessionPool(driver)

settings = ydb.BaseRequestSettings().with_timeout(30).with_operation_timeout(20)


def get_insert(schema, table):
    keys = list(schema.keys())
    schema = ', '.join(f'{k}:{schema[k]}' for k in keys)
    keys = ', '.join(keys)
    return f'''
        DECLARE $inserts AS List<Struct<{schema}>>;
        INSERT INTO {table} ({keys})
        SELECT {keys}
        FROM AS_TABLE($inserts) AS table
    '''


def get_update(schema, table):
    keys = list(schema.keys())
    schema = ', '.join(f'{k}:{schema[k]}' for k in keys)
    keys = ', '.join(keys)
    return f'''
        DECLARE $updates AS List<Struct<{schema}>>;
        UPDATE {table} ON
        SELECT {keys} 
        FROM AS_TABLE($updates) AS table;
    '''


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
    return execute("SELECT id, title FROM books;")


def delete_book(id):
    print('delete_book:', id)
    execute(f"DELETE FROM paragraphs WHERE book_id={id};")
    execute(f"DELETE FROM chapters WHERE book_id={id};")
    execute(f"DELETE FROM books WHERE id={id};")

    return {"deleted": True}


def create_book(text):
    print('create_book:', len(text))
    book, chapters, paragraphs = parse(text)

    execute(f'INSERT INTO books (id) VALUES ({book["id"]});')

    schema = {
        'id': 'Uint64',
        'book_id': 'Uint64',
        'title': 'Utf8'
    }
    query = get_insert(schema, 'chapters')
    execute(query, {"$inserts": chapters})
    schema = {
        'book_id': 'Uint64',
        'chapter_id': 'Uint64',
        'i': 'Uint32',
        'en': 'Utf8'
    }
    query = get_insert(schema, 'paragraphs')
    execute(query, {"$inserts": paragraphs})

    return book


def load_book(id):
    print('load_book:', id)
    res = execute(f"SELECT * FROM books WHERE id={id};")
    book = res[0]
    book["chapters"] = execute(f"SELECT * FROM chapters WHERE book_id={id};")
    return book


def load_chapter(id):
    print('load_chapter:', id)
    return execute(f"SELECT i, ru, en FROM paragraphs WHERE chapter_id={id};")


def set_translate(chapter_id, i, ru):
    return {}


def get_translate(chapter_id, i, d=5):
    print('get_translate:', chapter_id, i)

    paragraphs = execute(f"SELECT id, i, en FROM paragraphs WHERE chapter_id={chapter_id} and i>={i - d} and i<={i + d} and ru is null;")
    if not paragraphs or not translate(paragraphs):
        return {}

    schema = {
        "id": "Int64",
        "ru": "Utf8"
    }
    query = get_update(schema, "paragraphs")
    updates = [{'id': q['id'], 'ru': q['ru']} for q in paragraphs]
    execute(query, {'$updates': updates})

    return {q['i']: q["ru"] for q in paragraphs}
