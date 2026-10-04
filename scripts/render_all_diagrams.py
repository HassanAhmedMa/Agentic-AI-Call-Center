import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

DIAGRAMS_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic\docs\diagrams")

def render_diagrams():
    mmd_files = list(DIAGRAMS_ROOT.glob("*/*.mmd"))
    print(f"Found {len(mmd_files)} .mmd files to render.")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1440})

        for mmd_path in mmd_files:
            rel = mmd_path.relative_to(DIAGRAMS_ROOT)
            print(f"Rendering: {rel}")
            mmd_content = mmd_path.read_text(encoding="utf-8")

            # Prepare HTML with white canvas styling
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
                  padding: 24px;
                  font-family: Arial, Helvetica, sans-serif;
                }}
                #container {{
                  background: #ffffff;
                  display: inline-block;
                  padding: 16px;
                  border: 2px solid #000000;
                }}
                svg {{
                  background-color: #ffffff !important;
                }}
              </style>
            </head>
            <body>
              <div id="container">
                <pre class="mermaid">
{mmd_content}
                </pre>
              </div>
              <script>
                mermaid.initialize({{
                  startOnLoad: true,
                  theme: 'base',
                  themeVariables: {{
                    'primaryColor': '#ffffff',
                    'primaryTextColor': '#000000',
                    'primaryBorderColor': '#000000',
                    'lineColor': '#000000',
                    'secondaryColor': '#ffffff',
                    'tertiaryColor': '#ffffff',
                    'edgeLabelBackground': '#ffffff',
                    'actorBkg': '#ffffff',
                    'actorTextColor': '#000000',
                    'actorBorder': '#000000',
                    'signalColor': '#000000',
                    'signalTextColor': '#000000',
                    'labelBoxBkgColor': '#ffffff',
                    'labelBoxBorderColor': '#000000',
                    'labelTextColor': '#000000',
                    'loopTextColor': '#000000',
                    'noteBorderColor': '#000000',
                    'noteBkgColor': '#ffffff',
                    'noteTextColor': '#000000',
                    'background': '#ffffff'
                  }}
                }});
              </script>
            </body>
            </html>
            """
            try:
                page.set_content(html)
                page.wait_for_selector('svg', timeout=10000)
                
                # Extract and clean SVG with explicit white background rect
                svg_content = page.eval_on_selector('#container svg', """svg => {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('width', '100%');
                    rect.setAttribute('height', '100%');
                    rect.setAttribute('fill', '#ffffff');
                    rect.setAttribute('stroke', '#000000');
                    rect.setAttribute('stroke-width', '1');
                    svg.insertBefore(rect, svg.firstChild);
                    return svg.outerHTML;
                }""")
                
                svg_target = mmd_path.with_suffix(".svg")
                # Do not overwrite custom use-case SVGs which already have stickmen and ovals
                if "02-use-cases" not in str(mmd_path):
                    svg_target.write_text(svg_content, encoding="utf-8")
                
                # Take screenshot of container
                container = page.query_selector('#container')
                png_target = mmd_path.with_suffix(".png")
                container.screenshot(path=str(png_target))
                print(f"  -> Generated {png_target.name} and {svg_target.name}")
            except Exception as e:
                print(f"  [ERROR] Failed to render {mmd_path.name}: {e}")

        browser.close()
    print("Done rendering all diagrams.")

if __name__ == "__main__":
    render_diagrams()
