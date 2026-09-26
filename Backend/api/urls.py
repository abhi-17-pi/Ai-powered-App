from django.urls import path
from . import views


urlpatterns = [

    path(
        "chat/",
        views.chat,
        name="chat"
    ),

    path(
        "images/generate/",
        views.generate_image,
        name="generate_image"
    ),

    path(
        "conversations/",
        views.create_conversation,
        name="create_conversation"
    ),

    path(
        "conversations/list/",
        views.list_conversations,
        name="list_conversations"
    ),

    path(
        "conversations/<int:conversation_id>/",
        views.get_conversation,
        name="get_conversation"
    ),

    path(
        "conversations/<int:conversation_id>/delete/",
        views.delete_conversation,
        name="delete_conversation"
    ),
]
