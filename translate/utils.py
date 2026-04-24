import os
import re

import requests
from random import getrandbits

import dotenv

dotenv.load_dotenv()

folder_id = os.getenv('FOLDER_ID')
api_key = os.getenv('TRANSLATE_API_KEY')

url = 'https://translate.api.cloud.yandex.net/translate/v2/translate'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Api-Key {api_key}'
}
payload = {
    'folderId': folder_id,
    'targetLanguageCode': 'ru',
    'sourceLanguageCode': 'en',
}


def get_ij(book, i, d=5):
    k = max(0, i - d + 1)
    while i > k and not book[i - 1]['ru']:
        i -= 1
    j = min(i + d, len(book))
    return i, j


def get_title(text: str) -> str:
    words = text.split()
    if len(words) > 16:
        for i, t in enumerate(words, 1):
            if t.endswith('.'):
                words = words[:i]
                break
    if len(words) > 16:
        for i, t in enumerate(words, 1):
            if i >= 4 and t.endswith(','):
                words = words[:i]
                break
    title = ' '.join(words[:16])
    title = re.sub(r'\W+', ' ', title)
    return ' '.join(t.capitalize() for t in title.split())


def translate(t) -> bool:
    payload['texts'] = [q['en'] for q in t]
    response = requests.post(url, headers=headers, json=payload)

    if not response.ok:
        return False

    result = response.json()
    for q, r in zip(t, result['translations']):
        q['ru'] = r['text']

    return True


def get_id():
    return getrandbits(64)


def parse(text):
    texts = re.split(r"\s*\n+\s*", text)
    texts = [t for t in texts if t]

    chapter_id = get_id()
    book_id = get_id()
    chapters = []
    paragraphs = []

    book = {"id": book_id}

    for i, en in enumerate(texts):
        if en.startswith('# '):
            chapter_id = get_id()
            chapters.append({
                "id": chapter_id,
                "book_id": book_id,
                "title": en.removeprefix('# ').strip()
            })
        elif not chapters:
            chapters.append({
                "id": chapter_id,
                "book_id": book_id,
                "title": en.strip('#').strip()
            })
        paragraphs.append({
            "book_id": book_id,
            "chapter_id": chapter_id,
            "i": i,
            "en": en
        })

    return book, chapters, paragraphs
