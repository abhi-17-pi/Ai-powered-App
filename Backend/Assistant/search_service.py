import os
import requests
import urllib.parse


def web_search(query):
    """
    Performs web search. If TAVILY_API_KEY is available, queries Tavily.
    Otherwise uses DuckDuckGo free instant search fallback.
    """
    api_key = os.getenv("TAVILY_API_KEY", "").strip()

    if api_key:
        try:
            response = requests.post(
                "https://api.tavily.com/search",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 3
                },
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as err:
            print(f"Tavily search failed, attempting free fallback: {err}")

    # Free DuckDuckGo Instant Answer / Abstract fallback
    try:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}, timeout=6)
        
        if response.status_code == 200:
            data = response.json()
            results = []
            
            # Abstract
            if data.get("AbstractText"):
                results.append({
                    "title": data.get("Heading") or query,
                    "content": data.get("AbstractText"),
                    "url": data.get("AbstractURL") or "https://duckduckgo.com/?q=" + encoded_query
                })
            
            # Related Topics
            for topic in data.get("RelatedTopics", [])[:3]:
                if isinstance(topic, dict) and topic.get("Text"):
                    results.append({
                        "title": topic.get("Text")[:60] + "...",
                        "content": topic.get("Text"),
                        "url": topic.get("FirstURL") or "https://duckduckgo.com"
                    })
            
            if results:
                return {"results": results}
    except Exception as err:
        print(f"DuckDuckGo fallback search error: {err}")

    return {"results": []}


def should_search(user_message):
    search_keywords = [
        "latest",
        "current",
        "today",
        "now",
        "recent",
        "news",
        "weather",
        "price",
        "score",
        "who is",
        "what happened",
    ]

    message = user_message.lower()
    return any(keyword in message for keyword in search_keywords)