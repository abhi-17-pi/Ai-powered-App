import os
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI


def reload_env():
    """
    Explicitly reloads .env on demand so any newly added or updated
    API keys are immediately recognized without needing to restart the server.
    """
    base_dir = Path(__file__).resolve().parent.parent
    env_file = base_dir / ".env"
    if env_file.exists():
        load_dotenv(dotenv_path=env_file, override=False)
    else:
        load_dotenv(override=False)


def get_ai_client_and_model(custom_api_key=None, custom_model=None, custom_provider=None):
    """
    Determines the appropriate provider, base URL, API key, and model.
    Defaults to Groq (ultra-fast, free tier at console.groq.com), with Google Gemini and OpenRouter support.
    """
    reload_env()

    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    provider = (custom_provider or os.getenv("AI_PROVIDER", "")).strip().lower()
    api_key = custom_api_key.strip() if custom_api_key else ""

    # Determine provider based on environment variables
    if not provider:
        if groq_key:
            provider = "groq"
        elif gemini_key:
            provider = "gemini"
        elif openrouter_key:
            provider = "openrouter"
        elif openai_key:
            provider = "openai"
        else:
            provider = "groq"

    # Retrieve api_key from environment if not supplied in request
    if not api_key:
        if provider == "groq":
            api_key = groq_key
        elif provider == "gemini":
            api_key = gemini_key
        elif provider == "openrouter":
            api_key = openrouter_key
        elif provider == "openai":
            api_key = openai_key


    # Provider configurations
    if provider == "gemini":
        base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
        default_model = "gemini-2.0-flash"
    elif provider == "openrouter":
        base_url = "https://openrouter.ai/api/v1"
        default_model = "meta-llama/llama-3.2-3b-instruct:free"
    elif provider == "openai":
        base_url = "https://api.openai.com/v1"
        default_model = "gpt-4o-mini"
    else:
        # Default to Groq: fastest free inference provider
        provider = "groq"
        base_url = "https://api.groq.com/openai/v1"
        default_model = "openai/gpt-oss-20b"

    raw_model = (custom_model or os.getenv("AI_MODEL", "")).strip()
    if not raw_model or (provider == "groq" and "llama-3.3-70b" in raw_model):
        model = default_model
    else:
        model = raw_model

    return provider, base_url, api_key, model


def generate_response(chat_history, search_results=None, temperature=0.2, custom_api_key=None, custom_model=None, custom_provider=None):
    """
    Generates a fast, high-quality AI response using a free cloud API (Groq / Gemini).
    """
    provider, base_url, api_key, model = get_ai_client_and_model(
        custom_api_key=custom_api_key,
        custom_model=custom_model,
        custom_provider=custom_provider
    )

    if not api_key:
     return (
        "AI is currently unavailable. "
        "Add a valid GROQ_API_KEY to Backend/.env to enable it."
    )

    

    system_content = (
        "You are SmartAi, an intelligent, helpful, and natural AI voice assistant.\n\n"
        "VOICE & CONVERSATION RULES:\n"
        "- Your answers are spoken aloud to the user using text-to-speech voice synthesis.\n"
        "- Reply directly, concisely, accurately, and naturally.\n"
        "- NEVER output markdown tables, ASCII tables, pipe characters (|), table separator dashes (|---|---|), or divider lines (--- or - - -).\n"
        "- Avoid unneeded symbols, hashtags, decorative dashes, and emojis that sound robotic or clunky when read aloud.\n"
        "- Use clean, concise paragraphs or simple bullet points.\n"
        "- Focus on accurate information without unnecessary fluff, symbols, or preamble."
    )

    if search_results:
        search_context_parts = []
        for result in search_results[:3]:
            title = result.get("title", "Web Source")
            content = result.get("content", "")[:600]
            search_context_parts.append(f"Title: {title}\nContent: {content}")

        search_context = "\n\n".join(search_context_parts)
        system_content += (
            "\n\nUse the web search results below as the primary source "
            "for current information. Do not invent current facts.\n\n"
            f"WEB SEARCH RESULTS:\n{search_context}"
        )

    messages = [
        {"role": "system", "content": system_content},
        *chat_history,
    ]

    start_time = time.time()
    try:
        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=30.0,
        )

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=800,
        )

        answer = response.choices[0].message.content.strip()
        elapsed = round(time.time() - start_time, 2)
        print(f"[{provider.upper()}] Response generated with model '{model}' in {elapsed}s")
        return answer

    except Exception as error:
        error_msg = str(error)
        print(f"AI generation error ({provider}): {error_msg}")
        
        # If model not found or rate limited on Groq, fallback to compound-mini or gpt-oss-20b
        if provider == "groq":
            candidate_fallbacks = ["openai/gpt-oss-20b", "groq/compound-mini"]
            for fallback_model in candidate_fallbacks:
                if fallback_model != model:
                    try:
                        print(f"Attempting fallback to {fallback_model} on Groq...")
                        fb_response = client.chat.completions.create(
                            model=fallback_model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=600,
                        )
                        return fb_response.choices[0].message.content.strip()
                    except Exception as fb_err:
                        print(f"Fallback {fallback_model} error: {fb_err}")

        if "401" in error_msg or "invalid_api_key" in error_msg.lower():
            return f"❌ **Authentication Error**: The provided API key for {provider.capitalize()} is invalid. Please check your key in Settings or `.env`."
        elif "429" in error_msg or "rate_limit" in error_msg.lower():
            return f"⏳ **Rate limit reached** for {provider.capitalize()}. Please wait a few moments or switch models in Settings."
        
        return f"⚠️ **Service Notice**: Could not complete request ({error_msg}). Please check your API key and connection."


def generate_summary(chat_history, custom_api_key=None):
    """
    Summarizes the conversation quickly using the configured cloud LLM.
    """
    provider, base_url, api_key, model = get_ai_client_and_model(custom_api_key=custom_api_key)
    if not api_key:
        return ""

    conversation_text = ""
    for message in chat_history:
        role = message.get("role", "user")
        content = message.get("content", "")
        conversation_text += f"{role}: {content}\n"

    summary_prompt = [
        {
            "role": "system",
            "content": (
                "Summarize the conversation briefly and factually. "
                "Keep key facts, decisions, and goals for future context."
            ),
        },
        {
            "role": "user",
            "content": conversation_text,
        },
    ]

    try:
        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=20.0,
        )
        response = client.chat.completions.create(
            model=model if provider != "groq" else "openai/gpt-oss-20b",
            messages=summary_prompt,
            temperature=0.2,
            max_tokens=300,
        )
        return response.choices[0].message.content.strip()
    except Exception as error:
        print(f"Summary generation error ({provider}):", error)
        return ""