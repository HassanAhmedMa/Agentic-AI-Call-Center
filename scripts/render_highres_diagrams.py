import os
from pathlib import Path
from playwright.sync_api import sync_playwright

DIAGRAMS_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic\docs\diagrams")

def render_highres():
    mmd_files = list(DIAGRAMS_ROOT.glob("*/*.mmd"))
    print(f"Found {len(mmd_files)} .mmd files to render.")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        # High resolution viewport and scale factor
        page = browser.new_page(viewport={"width": 2400, "height": 1800}, device_scale_factor=2)

        for mmd_path in mmd_files:
            rel = mmd_path.relative_to(DIAGRAMS_ROOT)
            # Skip use-cases because they have custom stickman SVGs
            if "02-use-cases" in str(mmd_path):
                continue

            print(f"Rendering high-res: {rel}")
            mmd_content = mmd_path.read_text(encoding="utf-8")

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
                  padding: 40px;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }}
                #container {{
                  background: #ffffff;
                  display: inline-block;
                  padding: 24px;
                }}
                svg {{
                  background-color: #ffffff !important;
                  max-width: none !important;
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
                  sequence: {{
                    useMaxWidth: false,
                    mirrorActors: false,
                    bottomMarginAdj: 10
                  }},
                  themeVariables: {{
                    'primaryColor': '#ffffff',
                    'primaryTextColor': '#0f172a',
                    'primaryBorderColor': '#1e293b',
                    'lineColor': '#1e293b',
                    'secondaryColor': '#f8fafc',
                    'tertiaryColor': '#ffffff',
                    'edgeLabelBackground': '#ffffff',
                    'actorBkg': '#ffffff',
                    'actorTextColor': '#0f172a',
                    'actorBorder': '#1e293b',
                    'signalColor': '#1e293b',
                    'signalTextColor': '#0f172a',
                    'labelBoxBkgColor': '#ffffff',
                    'labelBoxBorderColor': '#1e293b',
                    'labelTextColor': '#0f172a',
                    'loopTextColor': '#0f172a',
                    'noteBorderColor': '#1e293b',
                    'noteBkgColor': '#f1f5f9',
                    'noteTextColor': '#0f172a',
                    'fontSize': '18px',
                    'background': '#ffffff'
                  }}
                }});
              </script>
            </body>
            </html>
            """
            try:
                page.set_content(html)
                page.wait_for_selector('svg', timeout=15000)
                page.wait_for_timeout(500)

                svg_content = page.eval_on_selector('#container svg', """svg => {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('width', '100%');
                    rect.setAttribute('height', '100%');
                    rect.setAttribute('fill', '#ffffff');
                    rect.setAttribute('stroke', '#cbd5e1');
                    rect.setAttribute('stroke-width', '1');
                    svg.insertBefore(rect, svg.firstChild);
                    return svg.outerHTML;
                }""")

                svg_target = mmd_path.with_suffix(".svg")
                svg_target.write_text(svg_content, encoding="utf-8")

                container = page.query_selector('#container')
                png_target = mmd_path.with_suffix(".png")
                container.screenshot(path=str(png_target))
                print(f"  -> Generated {png_target.name}")
            except Exception as e:
                print(f"  [ERROR] Failed to render {mmd_path.name}: {e}")

        # Also render high-res for stickman use cases
        uc_dir = DIAGRAMS_ROOT / "02-use-cases"
        for uc_name in ["use-case-system", "use-case-ai-agent"]:
            svg_file = uc_dir / f"{uc_name}.svg"
            png_file = uc_dir / f"{uc_name}.png"
            page.goto(f"file:///{svg_file.as_posix()}")
            svg_el = page.query_selector("svg")
            if svg_el:
                svg_el.screenshot(path=str(png_file))
                print(f"  -> Rendered stickman high-res: {png_file.name}")

        browser.close()
    print("All diagrams successfully rendered at high resolution.")

if __name__ == "__main__":
    render_highres()
