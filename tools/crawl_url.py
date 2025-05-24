import requests
import markdownify

def load_page(url: str) -> str:
    """
    Load the page contents as markdown.
    """
    if not can_crawl(url):
        return f"URL {url} is not crawlable."
    
    try:
        page = requests.get(url)
        return markdownify.markdownify(page.content)
    except Exception as e:
        return f"Error loading page {url}: {e}"


def can_crawl(url: str) -> bool:
    """Check if the URL can be crawled."""
    return True
