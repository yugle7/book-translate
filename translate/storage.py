import boto3
from botocore.client import Config
import os

session = boto3.session.Session()
s3 = session.client(
    's3',
    endpoint_url='https://storage.yandexcloud.net',
    config=Config(signature_version='s3v4'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
)

bucket = 'book-translate'


def save(book, paragraphs):
    text = '\n\n'.join(q['ru'] for q in paragraphs)
    key = f'{book.title}.md'

    s3.put_object(Bucket=bucket, Key=key, Body=text.encode('utf-8'))

    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=0
    )
