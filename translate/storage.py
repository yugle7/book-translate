import os
import re
import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()


def get_key(book):
    title = re.sub(r'\s', '_', book.title.lower())
    title = re.sub(r'\W', '', title)
    return f'{title}.md'


def get_body(paragraphs):
    return '\n\n'.join(q['left'] for q in paragraphs if q['left']).encode('utf-8')


def get_link(book: dict, paragraphs: list[dict]) -> str:
    session = boto3.session.Session()
    s3 = session.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        config=Config(signature_version='s3v4'),
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    )

    bucket = 'book-translate'
    key = get_key(book)

    try:
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=get_body(paragraphs),
            ContentType='text/markdown; charset=utf-8'
        )
    except Exception as e:
        print(e)
        return ""

    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=3600
    )
