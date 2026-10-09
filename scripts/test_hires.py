from playwright.sync_api import sync_playwright
from PIL import Image

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 3200, "height": 2600}, device_scale_factor=2)
    mmd = open(r"docs\diagrams\07-deployment\deployment-diagram.mmd", encoding="utf-8").read()
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
      <style>
        body {{
          background: #ffffff;
          margin: 0;
          padding: 30px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }}
        #container {{
          background: #ffffff;
          display: inline-block;
          padding: 20px;
        }}
        svg {{
          width: 2400px !important;
          max-width: none !important;
          height: auto !important;
        }}
      </style>
    </head>
    <body>
      <div id="container">
        <pre class="mermaid">
{mmd}
        </pre>
      </div>
      <script>
        mermaid.initialize({{
          startOnLoad: true,
          theme: 'base',
          flowchart: {{
            useMaxWidth: false,
            htmlLabels: true
          }},
          themeVariables: {{
            'fontSize': '20px',
            'fontFamily': 'Arial, sans-serif',
            'primaryColor': '#ffffff',
            'primaryTextColor': '#0f172a',
            'primaryBorderColor': '#1e293b',
            'lineColor': '#1e293b',
            'secondaryColor': '#f8fafc',
            'tertiaryColor': '#ffffff',
            'edgeLabelBackground': '#ffffff'
          }}
        }});
      </script>
    </body>
    </html>
    """
    page.set_content(html)
    page.wait_for_selector("svg", timeout=15000)
    page.wait_for_timeout(1000)
    el = page.query_selector("#container")
    el.screenshot(path="test_deploy_hires.png")
    browser.close()

im = Image.open("test_deploy_hires.png")
print(f"Rendered test_deploy_hires.png: {im.size} (Width x Height)")
