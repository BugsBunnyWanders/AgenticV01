import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service as ChromeService
import markdownify
from typing import List, Dict, Union, Optional
import os

# --- Global WebDriver instance ---
# This is a simple way to share the driver across tool calls within the same agent process.
# Not suitable for concurrent users or distributed environments without modification.
_driver = None
_current_url_in_driver = None
SCREENSHOT_ACTION_FILENAME = "action_screenshot.jpeg"
SCREENSHOT_BROWSE_FILENAME = SCREENSHOT_ACTION_FILENAME

def _get_driver() -> webdriver.Chrome:
    """Initializes and returns a headless Chrome WebDriver instance, or returns existing one."""
    global _driver
    if _driver is None:
        print("[WebDriver] Initializing new headless Chrome driver...")
        chrome_options = webdriver.ChromeOptions()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage") # common in Docker/CI
        chrome_options.add_argument("window-size=1920,1080") # Set a reasonable window size
        try:
            # Explicitly use ChromeDriverManager to install/manage chromedriver
            print("[WebDriver] Using ChromeDriverManager to get/install ChromeDriver...")
            driver_path = ChromeDriverManager().install()
            print(f"[WebDriver] ChromeDriver path: {driver_path}")
            service = ChromeService(executable_path=driver_path)
            _driver = webdriver.Chrome(service=service, options=chrome_options)
            print("[WebDriver] ChromeDriver initialized successfully with ChromeDriverManager.")

        except Exception as e:
            print(f"[WebDriver] Error initializing Chrome Driver with ChromeDriverManager: {e}")
            print("[WebDriver] Falling back to Selenium Manager (default Selenium 4+ behavior)...")
            try:
                _driver = webdriver.Chrome(options=chrome_options)
                print("[WebDriver] ChromeDriver initialized successfully with Selenium Manager.")
            except Exception as e_fallback:
                print(f"[WebDriver] Error initializing Chrome Driver with Selenium Manager fallback: {e_fallback}")
                print("[WebDriver] Ensure ChromeDriver is installed and in your PATH, or webdriver-manager can access it, or Selenium Manager can operate correctly.")
                raise e_fallback # Re-raise the fallback exception
        _driver.set_page_load_timeout(30) # Set a page load timeout
    return _driver

def _navigate_if_needed(driver: webdriver.Chrome, url: str) -> bool:
    """Navigates to the URL if the driver is not already there. Returns True if navigation occurred."""
    global _current_url_in_driver
    # Normalize URLs for comparison (e.g., remove trailing slash)
    normalized_current_url = driver.current_url.strip('/') if driver.current_url else None
    normalized_target_url = url.strip('/') if url else None
    
    if normalized_current_url != normalized_target_url or _current_url_in_driver != normalized_target_url:
        print(f"[WebDriver] Navigating to: {url} (was on {driver.current_url}, tracked: {_current_url_in_driver})")
        try:
            driver.get(url)
            _current_url_in_driver = driver.current_url.strip('/') # Store normalized
            return True
        except TimeoutException:
            print(f"[WebDriver] Timeout navigating to {url}")
            raise 
        except Exception as e:
            print(f"[WebDriver] Error navigating to {url}: {e}")
            raise
    return False

def _capture_and_save_screenshot(driver: webdriver.Chrome, filename: str) -> bool:
    """Captures a screenshot and saves it to the filename. Returns True on success, False on error."""
    try:
        # Ensure the directory for the screenshot exists if it's not the current dir
        # For simplicity, assuming filename is just a name in the current working dir or an absolute path.
        # If screenshots are in a sub-folder, e.g., "screenshots/", os.makedirs(os.path.dirname(filename), exist_ok=True)
        # For now, using fixed filenames in current dir.
        if os.path.exists(filename):
            os.remove(filename) # Remove old screenshot if it exists
            print(f"[WebDriver] Removed existing screenshot: {filename}")
        driver.save_screenshot(filename)
        print(f"[WebDriver] Screenshot saved to {filename}")
        return True
    except Exception as e:
        print(f"[WebDriver] Error capturing or saving screenshot {filename}: {e}")
        return False

def browse_url(url: str) -> str:
    """Load the url, take a screenshot, and return page source as markdown. Screenshot is saved server-side."""
    global _current_url_in_driver
    try:
        driver = _get_driver()
        _navigate_if_needed(driver, url)
        
        page_source_markdown = markdownify.markdownify(driver.page_source)
        _current_url_in_driver = driver.current_url.strip('/')
        
        _capture_and_save_screenshot(driver, SCREENSHOT_ACTION_FILENAME)
        
        text_output = f"Successfully browsed to {driver.current_url}. Page content (markdown):\n{page_source_markdown[:2000]}... (truncated if long)"
        return text_output
    except Exception as e:
        _current_url_in_driver = None 
        error_message = f"Error browsing {url}: {str(e)}"
        return error_message

def find_interactive_elements(url: str, keywords: Optional[str] = None) -> Union[List[Dict[str, str]], str]:
    """
    Navigates to the URL and finds interactive elements (links, buttons, inputs).
    Optionally filters by keywords in text or attributes.
    Returns a list of elements, each with an 'id' (XPath), 'tag', 'text', and 'attributes', or an error string.
    NOTE: This tool does NOT save a screenshot itself.
    """
    global _current_url_in_driver
    try:
        driver = _get_driver()
        _navigate_if_needed(driver, url)

        elements_data = []
        selenium_elements = driver.find_elements(By.XPATH, "//a[@href] | //button | //input[not(@type='hidden')] | //textarea | //select | //details | //summary[parent::details]")
        
        print(f"[WebDriver] Found {len(selenium_elements)} candidate interactive elements on {driver.current_url}.")

        for i, el in enumerate(selenium_elements):
            try:
                tag = el.tag_name.lower()
                text_content = el.text
                if not text_content:
                    text_content = el.get_attribute('value') or el.get_attribute('aria-label') or el.get_attribute('placeholder') or el.get_attribute('title') or ""
                
                text_content = text_content.strip().replace('\n', ' ').replace('\r', ' ')[:150]

                # Generate XPath for the element
                # This is a more robust way to get an XPath for an element
                script = """
                function getPathTo(element) {
                    if (element.id!=='')
                        return 'id(\"'+element.id+'\")';
                    if (element===document.body)
                        return element.tagName.toLowerCase();

                    var ix= 0;
                    var siblings= element.parentNode.childNodes;
                    for (var i= 0; i<siblings.length; i++) {
                        var sibling= siblings[i];
                        if (sibling===element)
                            return getPathTo(element.parentNode)+'/'+element.tagName.toLowerCase()+'['+(ix+1)+']';
                        if (sibling.nodeType===1 && sibling.tagName===element.tagName)
                            ix++;
                    }
                }
                return getPathTo(arguments[0]);
                """
                try:
                    xpath_id = driver.execute_script(script, el)
                except Exception as e_xpath:
                    print(f"[WebDriver] Could not generate robust XPath for element {i} ({tag}): {e_xpath}. Falling back to basic ID.")
                    xpath_id = f"xpath_fallback_{i}_{tag}"


                if keywords:
                    kw_lower = keywords.lower()
                    # Check in text, id, name, class, aria-label, placeholder, title
                    if not (kw_lower in text_content.lower() or 
                            kw_lower in (el.get_attribute('id') or "").lower() or
                            kw_lower in (el.get_attribute('name') or "").lower() or
                            kw_lower in (el.get_attribute('class') or "").lower() or
                            kw_lower in (el.get_attribute('aria-label') or "").lower() or
                            kw_lower in (el.get_attribute('placeholder') or "").lower() or
                            kw_lower in (el.get_attribute('title') or "").lower() or
                            kw_lower in xpath_id.lower()): # Also check in generated XPath
                        continue

                attrs = {"tag": tag}
                if tag == 'a': attrs['href'] = el.get_attribute('href')
                if tag == 'input': 
                    attrs['type'] = el.get_attribute('type')
                    attrs['name'] = el.get_attribute('name')
                    attrs['placeholder'] = el.get_attribute('placeholder')
                    attrs['value'] = el.get_attribute('value')
                if tag == 'button': 
                    attrs['name'] = el.get_attribute('name')
                    btn_type = el.get_attribute('type')
                    if btn_type: attrs['type'] = btn_type
                if tag == 'textarea': attrs['name'] = el.get_attribute('name')
                if tag == 'select': attrs['name'] = el.get_attribute('name')
                
                # Add visible, enabled, selected states
                attrs['visible'] = el.is_displayed()
                attrs['enabled'] = el.is_enabled()
                if tag in ['input', 'option']:
                    attrs['selected'] = el.is_selected()
                
                elements_data.append({
                    "id": xpath_id, 
                    "tag": tag,
                    "text": text_content if text_content else f"[{tag} element]",
                    "attributes": {k: v for k, v in attrs.items() if v is not None and v != ""}
                })
            except Exception as e_inner:
                print(f"[WebDriver] Error processing an element: {e_inner}")
                continue

        _current_url_in_driver = driver.current_url.strip('/')
        if not elements_data and keywords:
            return f"No interactive elements found on {driver.current_url} matching keywords: '{keywords}'."
        elif not elements_data:
            return f"No interactive elements found on {driver.current_url}."
        return elements_data
    except Exception as e:
        _current_url_in_driver = None
        return f"Error finding interactive elements on {url}: {str(e)}"

def click_element_by_id(url: str, element_id: str) -> str:
    """
    Navigates to the URL if needed, finds an element by its ID (XPath), clicks it.
    Returns a status string. A screenshot is saved server-side.
    """
    global _current_url_in_driver
    try:
        driver = _get_driver()
        _navigate_if_needed(driver, url)
        
        print(f"[WebDriver] Attempting to find element by ID (XPath): {element_id}")
        element_to_click = driver.find_element(By.XPATH, element_id)

        element_text = (element_to_click.text or element_to_click.get_attribute('value') or element_to_click.get_attribute('aria-label') or "[no text]")[:100].strip()
        print(f"[WebDriver] Found element '{element_text}' (tag: {element_to_click.tag_name}), attempting click...")
        element_to_click.click()
        
        driver.implicitly_wait(0.5) 

        new_url = driver.current_url
        _current_url_in_driver = new_url.strip('/')
        
        _capture_and_save_screenshot(driver, SCREENSHOT_ACTION_FILENAME)
        
        text_output = f"Successfully clicked element (ID/XPath: {element_id}, Text: '{element_text}'). Current URL is now: {new_url}"
        return text_output
    except TimeoutException:
        error_message = f"Timeout after attempting to click element (ID/XPath: {element_id}) on {url}. Page may have been navigating or element not interactable."
        return error_message
    except Exception as e:
        _current_url_in_driver = None
        error_message = f"Error clicking element (ID/XPath: {element_id}) on {url}: {str(e)}"
        return error_message

def type_into_element_by_id(url: str, element_id: str, text_to_type: str) -> str:
    """
    Navigates to URL, finds input element by ID (XPath), types text.
    Returns a status string. A screenshot is saved server-side.
    """
    global _current_url_in_driver
    try:
        driver = _get_driver()
        _navigate_if_needed(driver, url)

        print(f"[WebDriver] Attempting to find input element by ID (XPath): {element_id} to type in.")
        element_to_type_into = driver.find_element(By.XPATH, element_id)
        
        element_text = (element_to_type_into.get_attribute('placeholder') or element_to_type_into.get_attribute('name') or "[input field]")[:50].strip()
        print(f"[WebDriver] Found input element '{element_text}', attempting to type...")
        element_to_type_into.clear()
        element_to_type_into.send_keys(text_to_type)
        
        _current_url_in_driver = driver.current_url.strip('/')
        _capture_and_save_screenshot(driver, SCREENSHOT_ACTION_FILENAME)
            
        text_output = f"Successfully typed '{text_to_type}' into element (ID/XPath: {element_id}, Label/Name: '{element_text}')."
        return text_output
    except TimeoutException:
        error_message = f"Timeout when trying to type into element (ID/XPath: {element_id}) on {url}."
        return error_message
    except Exception as e:
        _current_url_in_driver = None
        error_message = f"Error typing into element (ID/XPath: {element_id}) on {url}: {str(e)}"
        return error_message

def scroll_page_at_url(url: str, direction: str) -> str:
    """
    Navigates to URL, scrolls page. Returns status string. Screenshot saved server-side.
    Directions: "up", "down", "top", "bottom".
    """
    global _current_url_in_driver
    try:
        driver = _get_driver()
        _navigate_if_needed(driver, url)

        if direction == "down":
            driver.execute_script("window.scrollBy(0, window.innerHeight);")
        elif direction == "up":
            driver.execute_script("window.scrollBy(0, -window.innerHeight);")
        elif direction == "top":
            driver.execute_script("window.scrollTo(0, 0);")
        elif direction == "bottom":
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        else:
            return f"Error: Invalid scroll direction '{direction}'. Use 'up', 'down', 'top', or 'bottom'."
        
        driver.implicitly_wait(0.2) 

        _current_url_in_driver = driver.current_url.strip('/')
        _capture_and_save_screenshot(driver, SCREENSHOT_ACTION_FILENAME)

        text_output = f"Successfully scrolled {direction} on {driver.current_url}. New content might be visible."
        return text_output
    except TimeoutException:
        error_message = f"Timeout while scrolling {direction} on {url}."
        return error_message
    except Exception as e:
        _current_url_in_driver = None
        error_message = f"Error scrolling {direction} on {url}: {str(e)}"
        return error_message

def close_browser_session() -> str:
    """Closes the shared browser session if it's active."""
    global _driver, _current_url_in_driver
    if _driver:
        try:
            print("[WebDriver] Closing browser session...")
            # Before quitting, ensure any saved screenshot files are cleaned up if they are temporary.
            # For now, these filenames are fixed, so they will be overwritten.
            # If we used unique filenames per action, cleanup would be more important here.
            # Example:
            # if os.path.exists(SCREENSHOT_ACTION_FILENAME): os.remove(SCREENSHOT_ACTION_FILENAME)
            # if os.path.exists(SCREENSHOT_BROWSE_FILENAME): os.remove(SCREENSHOT_BROWSE_FILENAME)
            _driver.quit()
            return "Browser session closed successfully."
        except Exception as e:
            print(f"[WebDriver] Error while quitting driver: {e}")
            return f"Error closing browser session: {e}"
        finally:
            _driver = None
            _current_url_in_driver = None
            print("[WebDriver] Browser session closed and driver set to None.")
    else:
        print("[WebDriver] close_browser_session called but no active driver found.")
        return "No active browser session to close."

# Note: The agent instructions will need to guide the LLM on how to use these tools sequentially.
# e.g., 1. browse_url (or navigate_to_url if we add it)
#       2. find_interactive_elements (optionally with keywords)
#       3. click_element_by_id / type_into_element_by_id using the XPath from previous step
#       4. (Agent re-evaluates, maybe get_page_content or find_interactive_elements again)

# The `_get_element_by_xpath_id` is a simplified placeholder.
# A robust implementation of `find_interactive_elements` should return full XPaths as `id` values.
# Then, `click_element_by_id` and `type_into_element_by_id` can directly use that XPath.
# I have updated click and type tools to directly use the passed element_id as an XPath.
