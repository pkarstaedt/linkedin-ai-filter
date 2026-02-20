import requests
import json

# --- Configuration ---
SERVER_URL = "http://localhost:8000/score-linkedin-post"

# The text string you want the server to analyze.
# Modify this variable to test different LinkedIn posts.
TEST_POST_TEXT = """
I'll be honest — this might be controversial.

But someone needs to say it.

LinkedIn has an AI content problem. And it's — quite frankly — ruining the platform.

Here's what I mean — scroll through your feed right now. Go ahead. I'll wait.

Notice anything? Every. Single. Post. Sounds. The. Same.

The same cadence. The same structure. The same dramatic — almost theatrical — one-liner paragraphs designed to make you stop scrolling.

And here's the kicker — none of it is real. It's all AI-generated. Every last word.

Now — don't get me wrong — I'm not anti-technology. Far from it. But there's a difference between using AI as a tool and letting AI become your entire personality.

The signs are everywhere:

→ "I was sitting in a coffee shop when it hit me —"
→ "Here's what 10 years in [industry] taught me —"
→ "Most people won't tell you this — but —"
→ Perfectly structured. Zero soul.

We traded authenticity — the very thing that makes this platform valuable — for efficiency.

And that — in my humble opinion — is a tragedy.

Your voice matters. Your messy, imperfect, unpolished voice — that's what people actually want to hear.

Not another AI-generated word salad dressed up as "thought leadership."

Be human. That's it. That's the post.
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
