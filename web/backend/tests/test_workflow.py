import os
import tempfile
from pathlib import Path

import pytest

runtime = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(runtime.name) / 'test.db')
os.environ['UPLOAD_DIR'] = str(Path(runtime.name) / 'uploads')

from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as c:
        yield c


def headers(client, login):
    password = 'Admin1234' if login.startswith('admin') else 'Demo1234'
    r = client.post('/api/auth/login', json={'login': login, 'password': password})
    assert r.status_code == 200, r.text
    return {'Authorization': 'Bearer ' + r.json()['token']}


def test_pages_and_access(client):
    for path in ['/', '/login.html', '/cabinet.html', '/admin.html', '/api/health']:
        assert client.get(path).status_code == 200
    assert client.get('/api/cabinet').status_code == 401
    assert client.get('/api/admin/stats', headers=headers(client, 'demo@abit.kz')).status_code == 403


def test_application_validation_and_final_decision(client):
    user = headers(client, 'demo@abit.kz')
    admin = headers(client, 'admin@abit.kz')
    program = client.get('/api/programs').json()[0]['id']
    body = {'program_id': program, 'lang': 'kk', 'ent_score': 100, 'dorm': False}
    for endpoint, method in [('/api/application', client.put), ('/api/application/submit', client.post)]:
        assert method(endpoint, headers=user, json={**body, 'program_id': 999999}).status_code == 400
        assert method(endpoint, headers=user, json={**body, 'ent_score': 141}).status_code == 422
        assert method(endpoint, headers=user, json={**body, 'lang': 'invalid'}).status_code == 422
    assert client.post('/api/application/submit', headers=user, json=body).status_code == 200
    apps = client.get('/api/admin/applications', headers=admin).json()
    app_id = next(a['id'] for a in apps if a['user']['email'] == 'demo@abit.kz')
    assert client.post(f'/api/admin/applications/{app_id}/status', headers=admin, json={'status':'accepted'}).status_code == 200
    assert client.post('/api/application/submit', headers=user, json=body).status_code == 400
    assert client.put('/api/application', headers=user, json=body).status_code == 400
    assert client.get('/api/cabinet', headers=user).json()['application']['status'] == 'accepted'


def test_document_workflow(client):
    user = headers(client, 'demo@abit.kz')
    admin = headers(client, 'admin@abit.kz')
    doc = client.get('/api/cabinet', headers=user).json()['documents'][0]['id']
    url = f'/api/documents/{doc}/upload'
    review = f'/api/admin/documents/{doc}/review'
    assert client.post(review, headers=admin, json={'status':'ok'}).status_code == 400
    assert client.post(url, headers=user, files={'file':('empty.pdf', b'', 'application/pdf')}).status_code == 400
    assert client.post(url, headers=user, files={'file':('large.pdf', b'x'*(5*1024*1024+1), 'application/pdf')}).status_code == 400
    content = b'%PDF-1.4\n%%EOF'
    assert client.post(url, headers=user, files={'file':('doc.pdf', content, 'application/pdf')}).status_code == 200
    assert client.get(f'/api/documents/{doc}/file', headers=user).content == content
    assert client.post(review, headers=admin, json={'status':'ok'}).status_code == 200


def test_support_reply(client):
    user = headers(client, 'demo@abit.kz')
    admin = headers(client, 'admin@abit.kz')
    r = client.post('/api/tickets', headers=user, json={'subject':'Сұрақ', 'message':'Өтініш туралы сұрақ'})
    assert r.status_code == 200
    assert client.post(f"/api/admin/tickets/{r.json()['id']}/reply", headers=admin, json={'reply':'Жауап берілді', 'status':'answered'}).status_code == 200
    assert client.get('/api/cabinet', headers=user).json()['tickets'][0]['reply'] == 'Жауап берілді'
