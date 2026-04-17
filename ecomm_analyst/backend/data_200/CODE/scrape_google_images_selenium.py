"""
Google Images Scraper - Selenium Version
Downloads first image for each product from Google Images
"""

import csv
import os
import time
import requests
from PIL import Image
from io import BytesIO
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

OUTPUT_DIR = "google_images_selenium_final"
CSV_FILE = "products.csv"

def setup_driver():
    """Setup Selenium Chrome driver"""
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def download_image(url, filename):
    """Download image from URL and save"""
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        
        # Open image and convert to RGB (remove alpha channel)
        img = Image.open(BytesIO(response.content))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        # Save
        img.save(filename, 'JPEG', quality=90)
        return True
    except Exception as e:
        print(f"❌ Download failed")
        return False

def scrape_google_images_selenium():
    """Scrape Google Images for products using Selenium"""
    
    # Read products
    products = []
    with open(CSV_FILE, 'r') as f:
        reader = csv.DictReader(f)
        products = list(reader)
    
    print(f"\n{'='*80}")
    print(f"GOOGLE IMAGES SCRAPER - SELENIUM (FIXED)")
    print(f"{'='*80}")
    print(f"Found {len(products)} products\n")
    
    driver = setup_driver()
    successful = 0
    failed = 0
    
    try:
        for idx, product in enumerate(products[:15], 1):  # Test with first 15
            product_name = product['name']
            filename = f"{OUTPUT_DIR}/google_{idx:03d}.jpg"
            
            # Skip if already downloaded
            if os.path.exists(filename):
                print(f"[{idx:2}/15] ⏭️  {product_name[:50]:<50} (exists)")
                continue
            
            print(f"[{idx:2}/15] 🔍 {product_name[:50]:<50}", end=" ", flush=True)
            
            try:
                # Navigate
                search_url = f"https://www.google.com/search?q={product_name}&tbm=isch"
                driver.get(search_url)
                
                # Wait 9 seconds for page to fully render
                print("⏳", end="", flush=True)
                time.sleep(9)
                
                img_url = None
                
                # Strategy 1: Find all img tags and extract valid URLs
                images = driver.find_elements(By.TAG_NAME, "img")
                for img in images:
                    src = img.get_attribute("src")
                    if src and not src.startswith("data:") and ("http" in src or len(src) > 100):
                        img_url = src
                        break
                
                # Strategy 2: Try clicking first image and getting high-res version
                if not img_url:
                    try:
                        # Find clickable images
                        clickables = driver.find_elements(By.CSS_SELECTOR, "div[role='button'] img")
                        if clickables:
                            driver.execute_script("arguments[0].click();", clickables[0])
                            time.sleep(3)
                            
                            # Get image from expanded view
                            try:
                                img_elem = driver.find_element(By.CSS_SELECTOR, "img.n3VNCb")
                                img_url = img_elem.get_attribute("src")
                            except:
                                images = driver.find_elements(By.TAG_NAME, "img")
                                for img in images:
                                    src = img.get_attribute("src")
                                    if src and "http" in src and len(src) > 100:
                                        img_url = src
                                        break
                    except:
                        pass
                
                # Strategy 3: Scroll and find images
                if not img_url:
                    driver.execute_script("window.scrollBy(0, 300);")
                    time.sleep(2)
                    images = driver.find_elements(By.TAG_NAME, "img")
                    for img in images:
                        src = img.get_attribute("src")
                        if src and not src.startswith("data:") and "http" in src and len(src) > 100:
                            img_url = src
                            break
                
                if not img_url:
                    print("❌ No URL found")
                    failed += 1
                    continue
                
                # Download
                if download_image(img_url, filename):
                    print("✅")
                    successful += 1
                else:
                    failed += 1
                    
            except Exception as e:
                print(f"❌ Error")
                failed += 1
            
            time.sleep(1)
    
    finally:
        driver.quit()
    
    print(f"\n{'='*80}")
    print(f"Results: ✅ {successful} successful, ❌ {failed} failed")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    scrape_google_images_selenium()
