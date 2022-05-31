import lokalise
import requests
import io
import zipfile
import os
import base64
import time

from dotenv import load_dotenv

load_dotenv()


client = lokalise.Client(os.getenv('API_KEY'))

print("Creating a new project...")

project = client.create_project({
    "name": "Python Sample Project",
    "description": "Here's my Python project",
    "languages": [
        {"lang_iso": "en"},
        {"lang_iso": "fr"}
    ],
    "base_lang_iso": "en"
})

project_id = project.project_id

print("Inviting contributors...")

contributors = client.create_contributors(project_id, [
    {
        "email": "translator@example.com",
        "fullname": "Mr. Translator",
        "is_admin": False,
        "is_reviewer": True,
        "languages": [
            {
                "lang_iso": "en",
                "is_writable": False
            },
            {
                "lang_iso": "fr",
                "is_writable": True
            }
        ]
    }
])

contributor = contributors.items[0]

print(contributor.email)
print(contributor.user_id)

print("Uploading translation file...")


def is_uploaded(api_client, project, process):
    for _i in range(5):
        process = api_client.queued_process(project, process.process_id)

        if process.status == 'finished':
            return True

        time.sleep(1)

    return False


filename = os.path.join(os.path.dirname(__file__), 'i18n/en.json')
with open(filename) as f:
    content = f.read()
    file_data = base64.b64encode(content.encode()).decode()

    bg_process = client.upload_file(project_id, {
        "data": file_data,
        "filename": 'en.json',
        "lang_iso": 'en'
    })

    print(f"Checking status for process {bg_process.process_id}...")
    result = is_uploaded(client, project_id, bg_process)
    print(result)

print("Fetching translation keys...")

keys = client.keys(project_id).items
key_ids = list(map(lambda k: k.key_id, keys))
print(key_ids)

print("Assigning a translation task...")

task = client.create_task(project_id, {
    "title": "Translate French",
    "keys": key_ids,
    "languages": [
        {
            "language_iso": "fr",
            "users": [contributor.user_id]
        }
    ]
})

print(task.title)
print(task.languages[0].language_iso)

print("Downloading translation file...")

response = client.download_files(project_id, {
    "format": "json",
    "filter_langs": ["fr"],
    "original_filenames": True,
    "directory_prefix": ""
})

data = io.BytesIO(requests.get(response['bundle_url']).content)

with zipfile.ZipFile(data) as archive:
    archive.extract("fr.json", path="src/i18n/")