from playwright.sync_api import sync_playwright
from pathlib import Path
import pandas as pd
import random
import shutil
import colorsys

class FontDatasetGenerator:
    def __init__(self, output_dir="data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.playwright = None
        self.browser = None
        self.page = None
    
    def generate_contrasting_colors(self):
        """Generate background and text colors with sufficient contrast"""
        # Generate random background color
        bg_hue = random.random()
        bg_sat = random.uniform(0.1, 0.9)
        bg_val = random.uniform(0.2, 0.9)
        
        bg_r, bg_g, bg_b = colorsys.hsv_to_rgb(bg_hue, bg_sat, bg_val)
        bg_r, bg_g, bg_b = int(bg_r * 255), int(bg_g * 255), int(bg_b * 255)
        
        # Calculate luminance for contrast
        def luminance(r, g, b):
            r, g, b = [x/255.0 for x in (r, g, b)]
            r = r/12.92 if r <= 0.03928 else ((r+0.055)/1.055)**2.4
            g = g/12.92 if g <= 0.03928 else ((g+0.055)/1.055)**2.4
            b = b/12.92 if b <= 0.03928 else ((b+0.055)/1.055)**2.4
            return 0.2126*r + 0.7152*g + 0.0722*b
        
        bg_lum = luminance(bg_r, bg_g, bg_b)
        
        # Choose text color for good contrast (aim for 4.5:1 ratio minimum)
        if bg_lum > 0.5:
            # Light background, use dark text
            text_val = random.uniform(0.0, 0.3)
        else:
            # Dark background, use light text
            text_val = random.uniform(0.7, 1.0)
            
        text_hue = random.random()
        text_sat = random.uniform(0.0, 0.8)
        
        text_r, text_g, text_b = colorsys.hsv_to_rgb(text_hue, text_sat, text_val)
        text_r, text_g, text_b = int(text_r * 255), int(text_g * 255), int(text_b * 255)
        
        return f"rgb({bg_r},{bg_g},{bg_b})", f"rgb({text_r},{text_g},{text_b})"
        
    def get_google_fonts(self, limit=50):
        """Get list of popular Google Fonts"""
        return [
            'Comic Sans MS', 'Impact', 'Times New Roman',
            'Arial', 'Lobster', 'Crimson Text',
            'Open Sans', 'Roboto', 'Lato', 'Montserrat',
            'Oswald', 'Raleway', 'Nunito',
            'Ubuntu', 'Playfair Display', 'Merriweather', 'Poppins', 'Inter'
        ][:limit]
    
    def start_browser(self, fonts):
        """Initialize browser instance with all fonts preloaded"""
        if not self.playwright:
            self.playwright = sync_playwright().start()
            self.browser = self.playwright.chromium.launch(headless=True)
            self.page = self.browser.new_page()
            self._setup_fonts(fonts)
    
    def stop_browser(self):
        """Clean up browser instance"""
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
    
    def _setup_fonts(self, fonts):
        """Setup HTML page with all fonts preloaded"""
        font_links = '\n'.join([
            f'<link href="https://fonts.googleapis.com/css2?family={font.replace(" ", "+")}:wght@400&display=swap" rel="stylesheet">'
            for font in fonts
        ])
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            {font_links}
            <style>
                body {{ margin: 0; padding: 20px; }}
                #container {{ background: white; }}
            </style>
        </head>
        <body>
            <div id="container"></div>
            <script>
                function renderText(text, fontFamily, containerWidth, fontSize, paddingTop, paddingRight, paddingBottom, paddingLeft, textAlign, bgColor, textColor, fontWeight) {{
                    const container = document.getElementById('container');
                    container.style.width = containerWidth + 'px';
                    container.style.fontFamily = '"' + fontFamily + '", sans-serif';
                    container.style.fontSize = fontSize + 'px';
                    container.style.color = textColor || 'black';
                    container.style.backgroundColor = bgColor || 'white';
                    container.style.fontWeight = fontWeight || 'normal';
                    container.style.wordWrap = 'break-word';
                    container.style.padding = paddingTop + 'px ' + paddingRight + 'px ' + paddingBottom + 'px ' + paddingLeft + 'px';
                    container.style.textAlign = textAlign;
                    container.textContent = text;
                }}
            </script>
        </body>
        </html>
        """
        
        self.page.set_content(html_content)
        
        # Wait for fonts to load
        self.page.evaluate("""
            async () => {
                await document.fonts.ready;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        """)
    
    def render_font_sample(self, text, font_family):
        """Render text with specified font in a container of random width and size"""
        
        font_size = random.randint(10, 100)
        
        # Random padding for each side
        padding_top = random.randint(0, 150)
        padding_right = random.randint(0, 150)
        padding_bottom = random.randint(0, 150)
        padding_left = random.randint(0, 150)

        # Adjust container width based on text length
        container_width = int(len(text) * font_size / 10. + random.randint(200, 800))
        
        # Random text alignment
        alignments = ['left', 'center', 'right']
        text_alignment = random.choice(alignments)
        
        # Use color 50% of the time
        use_color = random.random() < 0.5
        if use_color:
            bg_color, text_color = self.generate_contrasting_colors()
        else:
            bg_color, text_color = 'white', 'black'
        
        # Random font weight (50% chance of bold)
        font_weight = 'bold' if random.random() < 0.5 else 'normal'
        
        # Escape text for JavaScript
        escaped_text = text.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'")
        
        # Render text in container
        self.page.evaluate(f'''
            renderText("{escaped_text}", "{font_family}", {container_width}, {font_size}, {padding_top}, {padding_right}, {padding_bottom}, {padding_left}, "{text_alignment}", "{bg_color}", "{text_color}", "{font_weight}")
        ''')
        
        # Take screenshot of container
        container = self.page.locator('#container')
        screenshot = container.screenshot()
        
        return screenshot
    
    def load_phrases(self, csv_path="phrases_10000.csv"):
        """Load phrases from CSV file"""
        df = pd.read_csv(csv_path)
        return df['phrase'].tolist()
    
    def generate_samples(self, texts=None, fonts=None, samples_per_font=500):
        """Generate font samples and save as images"""
        # Clear existing data folder
        if self.output_dir.exists():
            print(f"Clearing existing data folder: {self.output_dir}")
            shutil.rmtree(self.output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        if texts is None:
            all_phrases = self.load_phrases()
            texts = random.sample(all_phrases, min(samples_per_font, len(all_phrases)))
        
        if fonts is None:
            fonts = self.get_google_fonts(20)
        
        print(f"Generating samples for {len(fonts)} fonts...")
        
        try:
            self.start_browser(fonts)
            
            for font_idx, font_family in enumerate(fonts):
                print(f"Processing {font_family} ({font_idx+1}/{len(fonts)})")
                
                font_dir = self.output_dir / font_family.replace(' ', '_')
                font_dir.mkdir(exist_ok=True)
                
                for text_idx, text in enumerate(texts[:samples_per_font]):
                    screenshot = self.render_font_sample(text, font_family)
                    
                    filename = f"sample_{text_idx:02d}.png"
                    filepath = font_dir / filename
                    
                    with open(filepath, 'wb') as f:
                        f.write(screenshot)
                        
                    print(f"  Saved: {filename}")
        
        finally:
            self.stop_browser()

if __name__ == "__main__":
    generator = FontDatasetGenerator()
    generator.generate_samples()
