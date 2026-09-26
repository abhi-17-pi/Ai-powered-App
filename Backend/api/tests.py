import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from Conversation.models import Conversation, Message


class ImageGenerationApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="image-user",
            password="correct-password",
        )
        self.conversation = Conversation.objects.create(user=self.user)
        self.client.force_login(self.user)

    @patch("api.views.generate_image_file", return_value="generated/test-image.png")
    def test_generates_and_persists_an_image_message(self, generate_image_file):
        response = self.client.post(
            "/api/images/generate/",
            data=json.dumps({
                "conversation_id": self.conversation.id,
                "prompt": "A watercolor sunset over a mountain lake",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["image_url"],
            "http://testserver/media/generated/test-image.png",
        )
        generate_image_file.assert_called_once_with(
            "A watercolor sunset over a mountain lake"
        )

        assistant_message = Message.objects.get(
            conversation=self.conversation,
            role="assistant",
        )
        self.assertEqual(assistant_message.image_path, "generated/test-image.png")

        history_response = self.client.get(
            f"/api/conversations/{self.conversation.id}/"
        )
        self.assertEqual(history_response.status_code, 200)
        self.assertEqual(
            history_response.json()["messages"][1]["image_url"],
            "http://testserver/media/generated/test-image.png",
        )
