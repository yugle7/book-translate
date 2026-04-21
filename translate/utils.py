import os

import requests

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
    j = i + 1
    while i and not book[i - 1]['ru'] and j - i < d:
        i -= 1
    j = min(max(j, i + d), len(book))
    return i, j


def translate(book, i):
    i, j = get_ij(book, i)

    payload['texts'] = [book[k]['en'] for k in range(i, j)]
    response = requests.post(url, headers=headers, json=payload)

    if response.ok:
        result = response.json()
        print('result:', result)
        for k, r in enumerate(result['translations'], i):
            book[k]['ru'] = r['text']

    return i, j
