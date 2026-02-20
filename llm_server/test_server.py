import requests
import json

# --- Configuration ---
SERVER_URL = "http://localhost:8000/score-linkedin-post"

# The text string you want the server to analyze.
# Modify this variable to test different LinkedIn posts.
TEST_POST_TEXT = """
Everyone uses AI tools that fit their role best.

Devs work in Cursor or Copilot, synced with the repo.
Designers prototype in ChatGPT, Midjourney, or something similar.
PMs refine requirements in Claude, Perplexity, or yet another tool.

Side effect:
team context stops being a coherent state.

The designer’s AI assumes the feature works one way.
The dev’s AI, looking at the code, assumes it works another.

GitHub MCP solves this for the code, but it misses the decision logs, the design intent, and the why that lives outside the repo.

I’m curious if you’ve run into this problem as well.

Do you have a way to keep team context aligned when each role works with a different AI and a different slice of reality?
"""
# TEST_POST_TEXT = "Hello everyone, excited to share my weekend plans!"
# TEST_POST_TEXT = "Just published a new paper on quantum computing. Link in bio!"


def test_server():
    """
    Sends a POST request to the local LLM server with a test text string
    and prints the response.
    """
    print(f"Testing local LLM server at: {SERVER_URL}")
    print(f"Sending text for analysis: \n---\n{TEST_POST_TEXT}\n---")

    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "linkedin_post_text": TEST_POST_TEXT
    }

    try:
        response = requests.post(SERVER_URL, headers=headers, data=json.dumps(payload), timeout=30)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)

        print("\n--- Server Response ---")
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")

        data = response.json()
        if "linkedin_post_ai_score" in data:
            score = data["linkedin_post_ai_score"]
            print(f"\nParsed AI Score: {score}")
            if 0 <= score <= 100:
                print("Score is within the valid range (0-100).")
            else:
                print("Warning: Score is outside the valid range (0-100).")
        else:
            print("Error: 'linkedin_post_ai_score' not found in response.")

    except requests.exceptions.ConnectionError:
        print(f"\nError: Could not connect to the server at {SERVER_URL}.")
        print("Please ensure the Flask server is running.")
    except requests.exceptions.Timeout:
        print(f"\nError: The request to {SERVER_URL} timed out after 10 seconds.")
        print("The server might be slow to respond or busy loading the model.")
    except requests.exceptions.RequestException as e:
        print(f"\nAn unexpected request error occurred: {e}")
    except json.JSONDecodeError:
        print(f"\nError: Could not decode JSON response from the server. Raw response: {response.text}")


if __name__ == "__main__":
    test_server()
