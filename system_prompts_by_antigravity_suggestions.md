# 🚀 Antigravity's Ultimate CLI Architecture Plan (V2)

Aap ne jo audio mein details share ki hain aur jo features aap ko chahiye (Auto-retry, Permissions, Auto-continue, Web Research for Builder/Planner, Yes/No Options), un ke mutabik maine system ko deeply analyze kiya hai.

Claude (Sonnet) ne jo suggestions di hain wo theek hain, lekin **11 roles bohot zyada hain**. Jab ek AI system mein 11 roles hote hain, toh AI confusion ka shikaar ho jata hai ("Main kis ko task assign karun?"), aur routing mein bohot time aur tokens waste hote hain. 

Meri expert advice yeh hai ke hum in 11 roles ko merge karke **Sirf 4 Super Roles** bana dein. Is se system lightning-fast, error-free, aur highly accurate ho jayega.

---

## 🌟 The "Super 4" Architecture (My Recommendation)

Bajaey 11 alag-alag agents ke, humein roles ko unki abilities ke hisaab se group karna chahiye:

### 1. 👁️ The Watcher (Master Coordinator & Manager)
* **Status:** Zaroori (Mandatory). Yeh system ka brain hai.
* **Role:** User intent samajhna, task route karna, errors pakarna, aur quality control karna.
* **Features it will handle:**
  * **Auto-Retry:** Aap ke menu se retry count (e.g., 3 ya 5) fetch karega. Agar Engineer/Builder fail ho jaye, toh automatically task wapas bheje ga.
  * **Permissions:** Aap ke menu se (Ask/Sensitive/Full) fetch karega aur downstream roles ko batayega ke kya limit hai.
  * **Auto-Continue:** Jab tak task 100% complete nahi hota, yeh system ko "Done" mark nahi karega aur process ko continue rakhega.

### 2. 📐 The Architect (Planner + Researcher)
* **Merged from:** Planner + Researcher.
* **Role:** System design, technical planning, web research, aur user alignment.
* **Features:**
  * Iske paas `search_web` ki permission lazmi hogi taake internet se latest docs (e.g., Next.js, React 19) parh sake.
  * **Strict Clarification Rule:** Kaam shuru karne se pehle yeh `ask_question` tool use karke **Yes/No/Custom Message** poochega.
  * User ke "Yes" ke baad yeh `plan.html` banayega aur auto-open karega.

### 3. 🛠️ The Engineer (Builder + Fixer + Reviewer)
* **Merged from:** Builder + Fixer + Reviewer.
* **Role:** Code likhna, bugs theek karna, aur apni hi code quality ko test/review karna.
* **Fayda (Benefit):** Pehle Builder code likhta tha aur Fixer theek karta tha, jis mein context lose ho jata tha. Ab ek hi "Engineer" code likhega, aur agar error aya, toh wohi khud usey fix karega! 
* **Features:** Iske paas bhi internet research (`search_web`) aur code graphs read karne ka access hoga taake fixing ke doran StackOverflow ya GitHub issues dekh sake.

### 4. ⚙️ The Operator (System & Web Agent)
* **Merged from:** System Agent + Web Agent.
* **Role:** Terminal commands chalana, browser automation, aur local system/machine tasks.
* **Fayda:** Dev operations aur System operations alag rahenge. Engineer sirf code likhega, aur Operator sirf shell commands/browser run karega. Is se security manage karna bohot asaan hoga.

---

## 🛠️ Ye Naya Flow Kaam Kaise Karega? (Step-by-Step)

1. **User Request:** User koi command/prompt deta hai.
2. **Watcher Analysis:** Watcher request receive karta hai. History aur Permissions check karta hai.
3. **Routing to Architect:** Agar naya feature ya architecture design hai, toh Watcher task **Architect** ko bhejta hai.
4. **Architect Clarification:** Architect user se sawal (Yes/No/Custom) poochta hai. Agar user custom message de tou plan adjust karta hai. Final Yes par `plan.html` banata hai.
5. **Routing to Engineer:** Watcher us approved plan ko uthata hai aur **Engineer** ko bhejta hai.
6. **Engineer Execution & Self-Fixing:** Engineer code likhta hai. Agar terminal/build mein error aye, toh Engineer khud (`search_web` use karke) bug fix karta hai.
7. **Watcher Quality Check:** Engineer kaam complete karke Watcher ko deta hai. Watcher check karta hai ke "kya requirements poori hui hain?".
8. **Auto-Retry Trigger:** Agar Watcher ko lagta hai ke kaam galat hai ya adhoora hai, toh woh aap ki set ki gayi "Auto Retry" limit ke mutabik Engineer ko dobara invoke karta hai.
9. **Final Output (Auto-Continue):** Jab task 100% perfect ho, tabhi Watcher loop end karke user ko final output display karta hai.

---

## 💡 "Stuck", "Errors" aur "Token Leaks" Se Bachne Ke Tips

Aap ne pucha ke errors na aayein aur AI foran samajh jaye, iske liye code/prompts mein yeh modifications lazmi hain:

1. **Chain of Thought (Sochne ka Process):** Har role ke prompt mein yeh line lazmi likhein:
   > *"Before taking any action, output your step-by-step thinking in a `<thought>` block. Analyze the code, then plan, then execute."*
   Is se AI hallucination 99% khatam ho jati hai kyunki wo blind edits nahi karta.

2. **Context Passing (Memory Management):** Jab Watcher kisi role (e.g., Engineer) ko task bheje, toh usay peeche ki saari raw chat history na bheje (is se token leak aur confusion hoti hai). Sirf **Current State**, **Approved Plan**, aur **Specific Goal** bheje.

3. **No Guessing Rule (Optimized for Code Graph):** Aap ne bilkul theek point raise kiya! Agar aap ke paas `Code Graph` mojood hai jo exact classes aur functions ki lines map kar leta hai, toh `read_file` se poori 5000 lines ki file read karna bilkul nuksan (token waste) hai. Is rule ko Code Graph ke hisaab se upgrade karein:
   > *"DO NOT guess line numbers. ALWAYS query the 'Code Graph' to get the exact start and end lines of the target function or class. Do NOT read the entire file if you only need to edit a specific mapped function. Apply surgical edits to those specific lines only."*
   *(Fayda: AI seedha graph se line numbers uthayega aur directly edit karega. Fast, token-efficient, aur error-free!)*

## 🏆 Final Conclusion
11 roles rakhne se CLI editor bulky aur confused rahega. **Super 4 Architecture** (Watcher, Architect, Engineer, Operator) aap ke saare required features (Auto-retry, Permissions, Auto-continue, Interactive Planning, Web Research) ko flawlessly support karega. Ye approach modular hai, resources (tokens) bachati hai, aur exact wahi kaam karegi jo aap ek perfect AI Agent se expect karte hain.
