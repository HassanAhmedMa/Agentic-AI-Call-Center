import re
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

REPO_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic")
DIAGRAMS_ROOT = REPO_ROOT / "docs" / "diagrams"

def clean_mmd_content(content: str) -> str:
    # Remove existing %%{init: ...}%% directives so our high-res styling takes effect cleanly
    cleaned = re.sub(r'%%\{init:[^}]*\}%%', '', content).strip()
    return cleaned

def render_all_ultra_res():
    targets = [
        DIAGRAMS_ROOT / "01-system-context" / "context-diagram.mmd",
        DIAGRAMS_ROOT / "03-architecture" / "architecture-subsystems.mmd",
        DIAGRAMS_ROOT / "03-architecture" / "ai-agent-workflow.mmd",
        DIAGRAMS_ROOT / "04-data" / "entity-relationship-diagram.mmd",
        DIAGRAMS_ROOT / "05-sequence" / "seq-appointment-booking.mmd",
        DIAGRAMS_ROOT / "05-sequence" / "seq-human-handoff.mmd",
        DIAGRAMS_ROOT / "07-deployment" / "deployment-diagram.mmd",
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 3800, "height": 3000}, device_scale_factor=2)

        for mmd_file in targets:
            rel = mmd_file.relative_to(DIAGRAMS_ROOT)
            print(f"Rendering ultra-res: {rel}")
            raw = mmd_file.read_text(encoding="utf-8")
            clean_content = clean_mmd_content(raw)
            is_sequence = "sequenceDiagram" in clean_content
            is_er = "erDiagram" in clean_content

            # Custom CSS tailored for crystal-clear readability
            font_size = "22px" if not is_sequence else "20px"
            svg_width = "2600px" if not is_sequence else "2800px"

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
                  padding: 30px;
                  border: 1px solid #e2e8f0;
                  border-radius: 8px;
                }}
                svg {{
                  background-color: #ffffff !important;
                  width: {svg_width} !important;
                  max-width: none !important;
                  height: auto !important;
                }}
                .node rect, .node circle, .node polygon {{
                  stroke-width: 2px !important;
                }}
                .edgePath path {{
                  stroke-width: 2.2px !important;
                }}
                .cluster rect {{
                  stroke-width: 2px !important;
                  fill: #f8fafc !important;
                  stroke: #94a3b8 !important;
                }}
                .messageText, .actor, .noteText {{
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                }}
              </style>
            </head>
            <body>
              <div id="container">
                <pre class="mermaid">
{clean_content}
                </pre>
              </div>
              <script>
                mermaid.initialize({{
                  startOnLoad: true,
                  theme: 'base',
                  flowchart: {{
                    useMaxWidth: false,
                    htmlLabels: true,
                    nodeSpacing: 50,
                    rankSpacing: 60
                  }},
                  sequence: {{
                    useMaxWidth: false,
                    mirrorActors: false,
                    bottomMarginAdj: 15,
                    messageMargin: 35,
                    actorMargin: 60,
                    boxMargin: 10
                  }},
                  themeVariables: {{
                    'fontFamily': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                    'fontSize': '{font_size}',
                    'primaryColor': '#ffffff',
                    'primaryTextColor': '#0f172a',
                    'primaryBorderColor': '#0284c7',
                    'lineColor': '#1e293b',
                    'secondaryColor': '#f0f9ff',
                    'tertiaryColor': '#ffffff',
                    'edgeLabelBackground': '#ffffff',
                    'actorBkg': '#ffffff',
                    'actorBorder': '#0284c7',
                    'actorTextColor': '#0f172a',
                    'signalColor': '#1e293b',
                    'signalTextColor': '#0f172a',
                    'labelBoxBkgColor': '#ffffff',
                    'labelBoxBorderColor': '#0284c7',
                    'labelTextColor': '#0f172a',
                    'loopTextColor': '#0f172a',
                    'noteBorderColor': '#0284c7',
                    'noteBkgColor': '#f0f9ff',
                    'noteTextColor': '#0f172a',
                    'clusterBkg': '#f8fafc',
                    'clusterBorder': '#94a3b8',
                    'titleColor': '#0f172a',
                    'background': '#ffffff'
                  }}
                }});
              </script>
            </body>
            </html>
            """
            try:
                page.set_content(html)
                page.wait_for_selector("svg", timeout=20000)
                page.wait_for_timeout(1000)

                container = page.query_selector("#container")
                png_target = mmd_file.with_suffix(".png")
                container.screenshot(path=str(png_target))
                
                im = Image.open(str(png_target))
                print(f"  -> Generated {png_target.name}: {im.size} (Width x Height)")
            except Exception as e:
                print(f"  [ERROR] Failed to render {mmd_file.name}: {e}")

        # Also ensure use cases are rendered ultra-sharp
        uc_dir = DIAGRAMS_ROOT / "02-use-cases"
        for uc_name in ["use-case-system", "use-case-ai-agent"]:
            svg_file = uc_dir / f"{uc_name}.svg"
            png_file = uc_dir / f"{uc_name}.png"
            page.goto(f"file:///{svg_file.as_posix()}")
            svg_el = page.query_selector("svg")
            if svg_el:
                svg_el.screenshot(path=str(png_file))
                im = Image.open(str(png_file))
                print(f"  -> Rendered stickman {png_file.name}: {im.size} (Width x Height)")

        browser.close()
    print("All diagrams rendered at ultra resolution.")

if __name__ == "__main__":
    render_all_ultra_res()
