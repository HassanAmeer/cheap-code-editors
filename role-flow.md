# 🤖 1. Auto Role (Master Coordinator)
Is role ko mukammal coordinator bana diya gaya hai:

Iske paas har role ki abilities (Planner, Builder, Fixer, Web Agent, System Agent, etc.) maujood hain.
Ye user ke single prompt ko analyze karega, aur uske mutabik dynamic decision le kar sahi role ko switch ya invoke karega bina boundaries cross kiye.





---
# 📋 2. Planner Role (Interactive Workflow & Auto-Open)
Planner ka naya workflow strictly implement ho chuka hai:

Shuru Shuru Me Sawal-Jawab (Clarification): Koi bhi plan generate karne se pehle, Planner sab se shuru me ask_question tool ka use karega. Darmiyan me ya end me koi sawal nahi pucha jayega.
Teen (3) Options: Questions me strictly teen options honge:
"Yes, proceed with planning." (Plan shuru karne ke liye)
"No, stop execution." (Halt karne ke liye)
Custom message write-in input box.
Response Handling:
Agar user No karega, to execution stop ho jayegi.
Agar user custom feedback message likhega, to planner use analyze karke plan ko edit karega aur behtar banayega.
Agar user Yes karega, to plan banaya jayega.
Plan Delivery & Auto-Open:
Plan ko markdown chat response me bhi dikhaya jayega.
Project root me ek beautiful, styled plan.html file create ki jayegi.
Us file ka direct markdown link chat me milega.
Auto-Open: Planner automatically system terminal command (open, start, ya xdg-open dependency on OS) execute kar ke us HTML plan ko seedha browser me launch kar dega, taake user ko file khud open na karni pare.



---























