import json

from django.contrib.auth.models import User
from django.test import TestCase


class AuthenticationApiTests(TestCase):
    def setUp(self):
        User.objects.create_user(
            username="account-user",
            email="account-user@example.com",
            password="correct-password",
        )

    def test_login_current_user_and_logout_manage_the_same_session(self):
        login_response = self.client.post(
            "/api/auth/login/",
            data=json.dumps({
                "username": "account-user",
                "password": "correct-password",
            }),
            content_type="application/json",
        )

        self.assertEqual(login_response.status_code, 200)

        current_user_response = self.client.get("/api/auth/me/")
        self.assertEqual(current_user_response.status_code, 200)
        self.assertEqual(
            current_user_response.json(),
            {
                "authenticated": True,
                "username": "account-user",
                "user_id": User.objects.get(username="account-user").id,
                "email": "account-user@example.com",
            },
        )

        logout_response = self.client.post("/api/auth/logout/")
        self.assertEqual(logout_response.status_code, 200)

        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
