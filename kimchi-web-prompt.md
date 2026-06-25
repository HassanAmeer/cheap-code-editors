# Kimchi.dev Website Recreation Prompt

*Copy and paste the entire prompt below into any AI (like v0.dev, Cursor, or ChatGPT) to recreate the exact design, vibe, and layout of the Kimchi.dev landing page.*

---

**System Prompt / Context:**
You are an expert Frontend Developer and UI/UX Designer. Your task is to build a pixel-perfect, highly premium, modern landing page for a developer-focused AI tool called "Kimchi" (inspired by kimchi.dev). The product is a "Centralized gateway for managing SaaS and self-hosted AI models."

You must use **Next.js, Tailwind CSS, and Framer Motion** (or vanilla CSS with modern animations). The design must be ultra-sleek, dark-mode first, and have a strong "developer tools" aesthetic (similar to Vercel, Linear, or Raycast).

### 1. Design System & Tokens
Strictly adhere to the following design tokens. Do not deviate.

*   **Typography:**
    *   **Primary Font:** `Geist` (Import from Google Fonts: `family=Geist:wght@400;500;600;700;800;900`). This is mandatory for the sleek, Vercel-like look.
    *   **Code/Monospace Font:** `Geist Mono` or `Fira Code`. Use this for all CLI commands and code snippets.
*   **Color Palette (Strict):**
    *   **Background (Base):** `#000000` (Pure Black) or `#0A0A0A` (Extremely dark charcoal).
    *   **Primary Brand Color (Kimchi Red/Orange):** `#FF521D`. Use this for primary CTA buttons, glowing background gradients, and key highlight text.
    *   **Text (Headings):** `#FFFFFF` (Pure White).
    *   **Text (Paragraphs):** `#A1A1AA` (Zinc-400, muted grey).
    *   **Card/Surface Background:** `#171717` (Zinc-900) with a slight opacity for glassmorphism.
    *   **Borders:** `#262626` (Zinc-800) for subtle separation.

### 2. Global Aesthetics & Animations
*   **Vibe:** Premium, dark, high-tech, developer-first.
*   **Lighting/Glow:** Use a radial gradient glow behind the main hero image/terminal using a faded version of `#FF521D` (e.g., opacity 20% with a massive blur).
*   **Glassmorphism:** Navigation bar and bento-box cards should have a `backdrop-blur-md` effect.
*   **Animations:** Use Framer Motion for subtle fade-in-up animations when elements scroll into view. Hovering over cards should cause a slight upward lift (`translate-y-[-2px]`) and the border should subtly glow with the primary color.

### 3. Page Structure & Layout (A to Z)

Please build the following sections from top to bottom:

#### A. Header / Navbar
*   **Style:** Sticky top, frosted glass (`backdrop-blur-lg`), thin bottom border (`#262626`).
*   **Left:** Logo. A clean, minimalist text logo "Kimchi" in Geist bold.
*   **Center:** Navigation links: "Features", "Docs", "Pricing", "GitHub". Text should be muted grey, turning white on hover.
*   **Right:** Two buttons. "Sign In" (ghost button) and "Get Started" (solid background `#FF521D`, text white, rounded-md).

#### B. Hero Section
*   **Layout:** Center-aligned.
*   **Badge:** A small pill badge at the very top: "Announcing Kimchi v1.0 →" (with a subtle `#FF521D` border).
*   **Main Headline:** "Optimize Your LLM Infrastructure." (Massive font size, Geist 800 weight, pure white. Add a slight text-wrap balance).
*   **Subheadline:** "Centralized gateway for managing SaaS and self-hosted AI models. Deploy, route, and optimize with autoscaling and hibernation." (Max width 2xl, centered, muted grey).
*   **CTAs:** Two buttons side-by-side. 
    1. Primary: "Start Building for Free" (Color: `#FF521D`).
    2. Secondary: "Read the Docs" (Color: transparent, border white/grey).
*   **Hero Visual (The Terminal):** Below the buttons, show a beautifully styled fake MacOS terminal window.
    *   *Terminal Header:* 3 dots (red, yellow, green).
    *   *Terminal Body:* Darker background (`#050505`).
    *   *Code Inside:* `brew install getkimchi/tap/kimchi` then a simulated output of installing the CLI.
    *   *Glow:* Put a massive `#FF521D` blur blob behind this terminal window so it radiates light.

#### C. Features Section (Bento Grid)
*   **Layout:** A CSS Grid "Bento Box" layout (mix of wide and square cards).
*   **Section Title:** "Everything you need to scale AI."
*   **Cards:** 
    *   Background: `#171717`. Border: 1px solid `#262626`. Rounded corners: `rounded-xl`.
    *   *Card 1 (Wide):* **Multi-Model Orchestration.** Show a visual diagram of a prompt splitting into different models (Claude, Llama, Minimax).
    *   *Card 2 (Square):* **Built-in Budget Controls.** Show a mini UI mockup of a spend limit progress bar.
    *   *Card 3 (Square):* **Infrastructure Agnostic.** Show logos of AWS, GCP, and Local running inside Kimchi.

#### D. The Workflow Section (Code vs UI)
*   **Layout:** Two columns. Left side is text, right side is a code snippet block.
*   **Left Text:** "From Prompt to Pull Request." Explain the `/ferment` workflow. "Kimchi breaks down complex tasks and executes them autonomously."
*   **Right Code Block:** A beautiful syntax-highlighted code block showing a YAML configuration or a terminal session of the kimchi agent planning a task.

#### E. Footer
*   **Style:** Minimalist, dark.
*   **Content:** Logo on the left. Columns for "Product", "Resources", "Company", "Legal" on the right.
*   **Bottom:** Copyright 2026 Kimchi. All rights reserved.

### 4. Execution Rules
*   Do not use generic placeholder colors like "blue-500". STRICTLY stick to the `#FF521D` orange/red and the greyscale palette provided.
*   Ensure the contrast is extremely high. The site should look like a stealthy, high-end developer tool.
*   Use standard Tailwind spacing (`py-24`, `gap-8`) to give the design room to breathe. Do not clutter the UI.

---
*End of Prompt*
