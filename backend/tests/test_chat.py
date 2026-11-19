def test_chat_explains_bookings(anon):
    response = anon.post("/api/chat", json={"message": "How do bookings work?"})

    assert response.status_code == 200
    assert "owner confirms" in response.json()["reply"]


def test_chat_finds_active_resources(anon, owner):
    from tests.conftest import new_resource

    resource = new_resource(owner)
    response = anon.post("/api/chat", json={"message": "find projector"})

    assert response.status_code == 200
    assert response.json()["resources"][0]["id"] == resource["id"]
    assert response.json()["resources"][0]["path"] == f"/explore/{resource['id']}"


def test_chat_rejects_empty_message(anon):
    response = anon.post("/api/chat", json={"message": ""})

    assert response.status_code == 422
