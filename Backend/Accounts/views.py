from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login , logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json


@csrf_exempt
def register(request):

    # Only allow POST requests
    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST requests are allowed"},
            status=405
        )

    # Read JSON data
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid JSON request"},
            status=400
        )

    # Get registration details
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    # Validate required fields
    if not username or not email or not password:
        return JsonResponse(
            {"error": "Username, email and password are required"},
            status=400
        )

    # Check if username already exists
    if User.objects.filter(username=username).exists():
        return JsonResponse(
            {"error": "Username already exists"},
            status=400
        )

    # Create user
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    return JsonResponse({
        "message": "Registration successful",
        "user_id": user.id,
        "username": user.username
    }, status=201)

@csrf_exempt
def login_user(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST requests are allowed"},
            status=405
        )

    try:
        data = json.loads(request.body)

        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return JsonResponse(
                {"error": "Username and password are required"},
                status=400
            )

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user is not None:
            login(request, user)

            return JsonResponse({
                "message": "Login successful!",
                "username": user.username
            }, status=200)

        return JsonResponse(
            {"error": "Invalid username or password"},
            status=401
        )

    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid request data"},
            status=400
        )

@csrf_exempt
def logout_user(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Only POST requests are allowed"},
            status=405
        )

    logout(request)

    return JsonResponse({
        "message": "Logout successful"
    }, status=200)



@csrf_exempt
def current_user(request):
    if request.user.is_authenticated:
        date_joined_str = request.user.date_joined.strftime('%B %Y') if request.user.date_joined else ''
        return JsonResponse({
            "authenticated": True,
            "username": request.user.username,
            "user_id": request.user.id,
            "email": request.user.email or "No email provided",
            "date_joined": date_joined_str,
        })

    return JsonResponse({
        "authenticated": False
    }, status=401)
