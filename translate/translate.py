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


def get_translations(paragraphs: list[dict]) -> bool:
    payload['texts'] = [q['right'] for q in paragraphs]
    response = requests.post(url, headers=headers, json=payload)

    if not response.ok:
        return False

    result = response.json()
    for q, r in zip(paragraphs, result['translations']):
        q['left'] = r['text']

    return True
