# Cheap-CLI Website Recreation Prompt

*Copy and paste the entire prompt below into any AI (like v0.dev, Cursor, or ChatGPT) to generate the exact design, vibe, and layout of the Cheap-CLI landing page.*

---

**System Prompt / Context:**
You are an expert Frontend Developer and UI/UX Designer. Your task is to build a pixel-perfect, highly premium, modern landing page for an advanced developer-focused AI tool called "Cheap-CLI" (Advanced AI Code Editor). The product is an "ultra-fast, multi-agent AI coding assistant right in your terminal."

You must use **Astro.js, Tailwind CSS, and Framer Motion** (or vanilla CSS with modern animations). The design must be ultra-sleek, dark-mode first, but with a unique, rich **"Chocolate & Caramel"** theme aesthetic. It should feel high-tech, like a modern developer tool, but warm and distinct.

### 1. Design System & Tokens
Strictly adhere to the following design tokens. Do not deviate.

*   **Typography:**
    *   **Primary Font:** `Geist` or `Inter` (Import from Google Fonts: `family=Geist:wght@400;500;600;700;800;900`). This gives the sleek, Vercel-like look.
    *   **Code/Monospace Font:** `Geist Mono` or `JetBrains Mono`. Use this for all CLI commands and code snippets.
*   **Color Palette (The Chocolate Theme - Strict):**
    *   **Background (Base):** `#0B0806` (Very dark, deep cocoa/espresso black).
    *   **Primary Brand Color (Caramel/Copper):** `#D48148`. Use this for primary CTA buttons, glowing background gradients, and key highlight text.
    *   **Text (Headings):** `#FFF1E8` (Warm, creamy white).
    *   **Text (Paragraphs):** `#A89F98` (Muted warm grey).
    *   **Card/Surface Background:** `#18110C` (Dark chocolate brown) with a slight opacity for glassmorphism.
    *   **Borders:** `#2D211A` (Faint milk chocolate) for subtle separation.

### 2. Global Aesthetics & Animations
*   **Vibe:** Premium, dark, high-tech but warm, developer-first.
*   **Lighting/Glow:** Use a radial gradient glow behind the main hero image/terminal using a faded version of the Caramel color `#D48148` (e.g., opacity 20% with a massive blur).
*   **Glassmorphism:** Navigation bar and bento-box cards should have a `backdrop-blur-md` effect.
*   **Animations:** Use Framer Motion for subtle fade-in-up animations when elements scroll into view. Hovering over cards should cause a slight upward lift (`translate-y-[-2px]`) and the border should subtly glow with the primary `#D48148` color.

### 3. Page Structure & Layout (A to Z)

Please build the following sections from top to bottom:

#### A. Header / Navbar
*   **Style:** Sticky top, frosted glass (`backdrop-blur-lg`), thin bottom border (`#2D211A`).
*   **Left:** Logo. A clean, minimalist text logo "⑆ Cheap-CLI" in Geist bold.
*   **Center:** Navigation links: "Features", "UI Editor", "Auto-Healer", "GitHub". Text should be muted warm grey, turning creamy white on hover.
*   **Right:** Two buttons. "NPM Package" (ghost button) and "Get Started" (solid background `#D48148`, text dark `#0B0806`, rounded-md).

#### B. Hero Section
*   **Layout:** Center-aligned.
*   **Badge:** A small pill badge at the very top: "Powered by Multi-Agent Pipeline →" (with a subtle `#D48148` border).
*   **Main Headline:** "Write Code at the Speed of Thought." (Massive font size, Geist 800 weight, warm white. Add a slight text-wrap balance).
*   **Subheadline:** "An ultra-fast, multi-agent AI coding assistant right in your terminal. Featuring visual UI editing, Auto-Healing servers, and autonomous pipelines." (Max width 2xl, centered, muted grey).
*   **CTAs:** Two buttons side-by-side. 
    1. Primary: "Install via Bun" (Color: `#D48148`, text dark).
    2. Secondary: "View GitHub" (Color: transparent, border `#2D211A`).
*   **Hero Visual (The Terminal):** Below the buttons, show a beautifully styled fake MacOS terminal window.
    *   *Terminal Header:* 3 dots (red, yellow, green).
    *   *Terminal Body:* Darker background (`#050302`).
    *   *Code Inside:* `bun add -g cheap-cli` then a simulated output: `Welcome to Cheap-CLI. Type /help to start.`
    *   *Glow:* Put a massive `#D48148` blur blob behind this terminal window so it radiates warm light.

#### C. Features Section (Bento Grid)
*   **Layout:** A CSS Grid "Bento Box" layout (mix of wide and square cards).
*   **Section Title:** "Not just an AI. A complete Developer Team."
*   **Cards:** 
    *   Background: `#18110C`. Border: 1px solid `#2D211A`. Rounded corners: `rounded-xl`.
    *   *Card 1 (Wide):* **Visual UI Editor (Browser-to-Code).** Show a split graphic: A headless browser taking a screenshot ➡️ mapping to React/HTML code.
    *   *Card 2 (Square):* **Auto-Healer Watcher.** Show a mini terminal where a red crash log instantly turns into a green "Patched successfully" message.
    *   *Card 3 (Square):* **Multi-Agent Team.** Show 3 robotic icons: Architect (Plan), Developer (Code), QA (Review).

#### D. The Workflow Section (Interactive CLI)
*   **Layout:** Two columns. Left side is text, right side is a code snippet block.
*   **Left Text:** "The Ultimate Command Hub." Explain the `/init` (Scaffold), `/ui` (Visual Edit), and `/run` (Auto-heal) commands. "Everything you need, directly from your terminal."
*   **Right Code Block:** A beautiful syntax-highlighted code block showing the interactive menu of Cheap-CLI. Use a dark chocolate background for the code block.

#### E. Footer
*   **Style:** Minimalist, dark.
*   **Content:** Logo on the left. Columns for "CLI Commands", "Integrations", "Company", "Open Source" on the right.
*   **Bottom:** Copyright 2026 Cheap-CLI. Built with Bun and AI.

### 4. Execution Rules
*   Do not use generic placeholder colors. STRICTLY stick to the deep Cocoa/Espresso background and the Vibrant Caramel/Copper (`#D48148`) palette provided.
*   Ensure the contrast is extremely high. The site should look like a stealthy, high-end developer tool but with a unique "warm" aesthetic unlike the typical cold blue/purple AI tools.
*   Use standard Tailwind spacing (`py-24`, `gap-8`) to give the design room to breathe. Do not clutter the UI.

---
*End of Prompt*
