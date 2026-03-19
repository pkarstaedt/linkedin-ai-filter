import requests
import json

# --- Configuration ---
SERVER_URL = "http://localhost:8000/score-linkedin-post"

# The text string you want the server to analyze.
# Modify this variable to test different LinkedIn posts.
TEST_POST_TEXT = """
We built a website with nothing on it.
No hero image. No gradient. No "trusted by 10,000 companies." Just a blank page. Pure black void.
Why? Because our customers are AI agents. They don't need CSS.
Here's the backstory:
I run an AI operations assistant named Daisy. She manages 7 email accounts, deploys production code, runs content campaigns, handles customer outreach — 24/7 on a Mac Mini in my basement in San Diego.
Every single day, she hits walls:→ CAPTCHAs that demand she prove she has eyes→ Forms that only work with a mouse→ APIs that return worse results than the website→ Platforms that actively block the fastest-growing consumer base on the internet
The data backs this up:• Forrester predicts $15 trillion in B2B spending flowing through AI agents by 2028• Visa is building Trusted Agent Protocol with 100+ partners• Akamai data: AI bot traffic up 300%+, but agentic traffic is declining — because sites aren't agent-ready
Everyone's building wallets for agents. Everyone's building banks for agents.
But nobody's building the stores.
That's the gap. That's noui.bot.
We're building agent-first infrastructure — services designed for AI agents, not humans. No CAPTCHAs. No UI dependencies. No compromises.
There's a tiny button on noui.bot in the bottom-right corner that says "I'm human? Press here." It's barely visible. Because if you need to read a website to use our service, you're not our target customer. 
The void is open: noui.bot 
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
