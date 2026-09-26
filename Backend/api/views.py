import json
import time
from functools import wraps

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from Assistant.ai_service import generate_response, generate_summary
from Assistant.image_service import ImageGenerationError, generate_image_file
from Assistant.search_service import web_search, should_search
from Assistant.constants import (
    MAX_CONTEXT_MESSAGES,
    SUMMARY_MESSAGE_THRESHOLD,
    SUMMARY_CONTEXT_MESSAGES,
)

from Conversation.models import Conversation, Message


def public_image_url(request, image_path):
    if not image_path:
        return ""

    return request.build_absolute_uri(
        f"{settings.MEDIA_URL.rstrip('/')}/{image_path.lstrip('/')}"
    )


def api_login_required(view_function):
    @wraps(view_function)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse(
                {"error": "Authentication required"},
                status=401
            )

        return view_function(request, *args, **kwargs)

    return wrapper


@csrf_exempt
@api_login_required
def create_conversation(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST requests are allowed"},
            status=405
        )

    conversation = Conversation.objects.create(
        user=request.user,
        title="New Conversation"
    )

    return JsonResponse({
        "conversation_id": conversation.id,
        "title": conversation.title
    })


@csrf_exempt
@api_login_required
def generate_image(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST requests are allowed"},
            status=405
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON request"}, status=400)

    conversation_id = data.get("conversation_id")
    prompt = data.get("prompt", "").strip()

    if not conversation_id or not prompt:
        return JsonResponse(
            {"error": "conversation_id and prompt are required"},
            status=400
        )

    if len(prompt) > 2_000:
        return JsonResponse(
            {"error": "Image prompts must be 2,000 characters or fewer"},
            status=400
        )

    try:
        conversation = Conversation.objects.get(
            id=conversation_id,
            user=request.user
        )
    except Conversation.DoesNotExist:
        return JsonResponse({"error": "Conversation not found"}, status=404)

    Message.objects.create(
        conversation=conversation,
        role="user",
        content=prompt
    )

    if conversation.title == "New Conversation":
        conversation.title = prompt[:50]
        conversation.save(update_fields=["title"])

    try:
        image_path = generate_image_file(prompt)
    except ImageGenerationError as error:
        return JsonResponse({"error": str(error)}, status=503)

    assistant_message = "Here is the image I created from your prompt."
    Message.objects.create(
        conversation=conversation,
        role="assistant",
        content=assistant_message,
        image_path=image_path
    )

    return JsonResponse({
        "conversation_id": conversation.id,
        "user_message": prompt,
        "assistant_message": assistant_message,
        "image_url": public_image_url(request, image_path),
    })


@api_login_required
def list_conversations(request):
    if request.method != "GET":
        return JsonResponse(
            {"error": "Only GET requests are allowed"},
            status=405
        )

    conversations = Conversation.objects.filter(
        user=request.user
    ).order_by("-created_at")

    return JsonResponse({
        "conversations": [
            {
                "id": conversation.id,
                "title": conversation.title
            }
            for conversation in conversations
        ]
    })


@api_login_required
def get_conversation(request, conversation_id):
    if request.method != "GET":
        return JsonResponse(
            {"error": "Only GET requests are allowed"},
            status=405
        )

    try:
        conversation = Conversation.objects.get(
            id=conversation_id,
            user=request.user
        )

    except Conversation.DoesNotExist:
        return JsonResponse(
            {"error": "Conversation not found"},
            status=404
        )

    messages = conversation.messages.order_by("created_at")

    return JsonResponse({
        "conversation_id": conversation.id,
        "title": conversation.title,
        "messages": [
            {
                "role": message.role,
                "content": message.content,
                "image_url": public_image_url(request, message.image_path)
            }
            for message in messages
        ]
    })


@csrf_exempt
@api_login_required
def delete_conversation(request, conversation_id):
    if request.method != "DELETE":
        return JsonResponse(
            {"error": "Only DELETE requests are allowed"},
            status=405
        )

    try:
        conversation = Conversation.objects.get(
            id=conversation_id,
            user=request.user
        )

    except Conversation.DoesNotExist:
        return JsonResponse(
            {"error": "Conversation not found"},
            status=404
        )

    conversation.delete()

    return JsonResponse({
        "success": True,
        "message": "Conversation deleted successfully"
    })


@csrf_exempt
@api_login_required
def chat(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST requests are allowed"},
            status=405
        )

    try:
        data = json.loads(request.body)

    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid JSON request"},
            status=400
        )

    conversation_id = data.get("conversation_id")
    user_message = data.get("message", "")
    web_search_enabled = data.get("web_search_enabled", True)
    temperature = data.get("temperature", 0.2)
    custom_api_key = data.get("api_key")
    custom_model = data.get("model")
    custom_provider = data.get("provider")

    if not conversation_id or not user_message:
        return JsonResponse(
            {"error": "conversation_id and message are required"},
            status=400
        )

    try:
        conversation = Conversation.objects.get(
            id=conversation_id,
            user=request.user
        )

    except Conversation.DoesNotExist:
        return JsonResponse(
            {"error": "Conversation not found"},
            status=404
        )

    Message.objects.create(
        conversation=conversation,
        role="user",
        content=user_message
    )

    if conversation.title == "New Conversation":
        conversation.title = user_message[:50]
        conversation.save(update_fields=["title"])

    messages = conversation.messages.order_by(
        "-created_at"
    )[:MAX_CONTEXT_MESSAGES]

    messages = reversed(messages)
    chat_history = []

    if conversation.summary:
        chat_history.append({
            "role": "system",
            "content": f"Conversation summary: {conversation.summary}"
        })

    for message in messages:
        chat_history.append({
            "role": message.role,
            "content": message.content
        })

    search_results = []

    if web_search_enabled and should_search(user_message):
        try:
            search_data = web_search(user_message)
            search_results = search_data.get("results", [])

        except Exception as error:
            print("Web search error:", error)
            search_results = []

    start_time = time.time()

    try:
        assistant_response = generate_response(
            chat_history=chat_history,
            search_results=search_results,
            temperature=temperature,
            custom_api_key=custom_api_key,
            custom_model=custom_model,
            custom_provider=custom_provider,
        )

    except Exception as error:
        print("AI generation error:", error)

        return JsonResponse(
            {"error": f"Failed to generate AI response: {str(error)}"},
            status=500
        )

    print(
        "AI response time:",
        round(time.time() - start_time, 2),
        "seconds"
    )

    Message.objects.create(
        conversation=conversation,
        role="assistant",
        content=assistant_response
    )

    message_count = conversation.messages.count()

    if (
        message_count >= SUMMARY_MESSAGE_THRESHOLD
        and (
            not conversation.summary
            or message_count - conversation.last_summarized_count
            >= SUMMARY_MESSAGE_THRESHOLD
        )
    ):
        if not conversation.summary:
            summary_messages = conversation.messages.order_by(
                "created_at"
            )
        else:
            summary_messages = list(
                conversation.messages.order_by(
                    "-created_at"
                )[:SUMMARY_CONTEXT_MESSAGES]
            )

            summary_messages.reverse()

        summary_history = []

        if conversation.summary:
            summary_history.append({
                "role": "system",
                "content": (
                    "Previous conversation summary: "
                    f"{conversation.summary}"
                )
            })

        for message in summary_messages:
            summary_history.append({
                "role": message.role,
                "content": message.content
            })

        try:
            new_summary = generate_summary(summary_history, custom_api_key=custom_api_key)

            conversation.summary = new_summary
            conversation.last_summarized_count = message_count

            conversation.save(
                update_fields=[
                    "summary",
                    "last_summarized_count"
                ]
            )

        except Exception as error:
            print("Summary generation error:", error)

    return JsonResponse({
        "conversation_id": conversation.id,
        "user_message": user_message,
        "assistant_message": assistant_response,
        "sources": [
            {
                "title": result.get("title"),
                "url": result.get("url")
            }
            for result in search_results
        ]
    })
