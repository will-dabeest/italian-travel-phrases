\# Italian Travel Phrase Trainer — Full Specification for GitHub Copilot (Enhanced)



You (Copilot) will generate a complete, world-class, static web app that helps a traveler learn \*\*practical Italian words and phrases\*\* for a real trip to Italy.



The app must be:

\- 100% front-end only  

\- Deployable via Netlify CLI  

\- Using only free browser APIs (Web Speech API + Speech Synthesis)  

\- Highly performant  

\- Designed for \*\*dark mode first\*\*  

\- Equipped with a \*\*premium-level spaced repetition engine\*\*  

\- Beautiful, intuitive, and effective for real travel  



---



\# 1. CORE REQUIREMENTS



\## 1.1 Technical Constraints

\- No backend.

\- No paid or API-key-restricted services.

\- Use:

&nbsp; - \*\*Web Speech API\*\* for Italian recognition.

&nbsp; - \*\*Speech Synthesis API\*\* for example pronunciation.

\- Store progress, SRS (spaced repetition) metadata, and user preferences in \*\*localStorage\*\*.

\- Entire app must run offline after first load (implement a simple service worker).

\- Default to \*\*dark mode UI\*\* with subtle light-mode fallback.



\## 1.2 App Features Overview

Build an elegant, polished web app featuring:



\### Phrase Library

\- Organized by categories.

\- Search bar with fuzzy search.

\- Filters: “Needs Practice”, “Mastered”, “Difficult”.



\### Pronunciation Practice

\- Microphone-driven.

\- Wave or pulse animation while recording.

\- Multi-stage feedback:

&nbsp; - Recognition result

&nbsp; - Token-level match

&nbsp; - SRS difficulty rating



\### Learning Engine (Premium-Level)

Implement a \*\*Spaced Repetition System inspired by SM-2\*\*, adapted for short phrases:



For each phrase, store:

\- `interval`

\- `repetitions`

\- `easinessFactor`

\- `lastReviewed`

\- `nextReview`



Use the following logic (Copilot: implement fully):

\- Quality of response is mapped from accuracy score:

&nbsp; - Perfect: Q = 5  

&nbsp; - Close: Q = 4  

&nbsp; - Incorrect but attempt: Q = 2–3  

&nbsp; - Didn’t attempt: Q = 0–1  

\- Update EF (easinessFactor) per SM-2 rules  

\- Update interval:

&nbsp; - I(1) = 1  

&nbsp; - I(2) = 6  

&nbsp; - I(n) = I(n-1) × EF  

\- Schedule next review via localStorage.



Add:

\- Daily SRS queue  

\- “Overdue” review indicators  

\- Automatic mixing of new + review phrases  



---



\# 2. PERFORMANCE OPTIMIZATION REQUIREMENTS



Copilot: Optimize for speed, especially on mobile.



\### Required optimizations:

\- Use \*\*code splitting\*\* and lazy-load categories.

\- Preload only minimal assets upfront.

\- Efficient DOM rendering (avoid unnecessary reflows).

\- Debounced search input.

\- Cache `phrases.json` with service worker.

\- Avoid heavy libraries; use vanilla JS or extremely lightweight utilities.

\- Smooth 60fps animations (CSS transforms instead of properties causing layout).

\- Consider precomputing similarity results for common mistakes.



---



\# 3. FILE STRUCTURE (unchanged but optimized)



```

/

&nbsp; index.html

&nbsp; main.js

&nbsp; style.css

&nbsp; phrases.json

&nbsp; sw.js

&nbsp; /assets/

&nbsp;   logo.svg

&nbsp;   icons.svg

&nbsp; /utils/

&nbsp;   scoring.js

&nbsp;   audio.js

&nbsp;   recognition.js

&nbsp;   srs.js

&nbsp;   performance.js

```



---



\# 4. DARK MODE UI SPEC



\## 4.1 Design Style

Dark mode default:

\- Background: `#0F0F0F`  

\- Elevation layers: `#1A1A1A`, `#222222`  

\- Text: soft white `#F7F7F7`  

\- Accents:

&nbsp; - Basil green `#7BAF7B`

&nbsp; - Tuscan terracotta `#C96B47`

&nbsp; - Royal blue `#3A67C9`  



Typography:

\- Rounded sans serif (Inter or similar)

\- Large, readable text for phrases



\## 4.2 Light Mode

\- Automatic fallback  

\- Soft whites and warm neutrals  



Include a settings toggle.



---



\# 5. LOGIC SPECS (unchanged + SRS integration)



\## 5.1 Speech Recognition

\- Web Speech API `it-IT`

\- Timeout protection

\- Retry guidance



\## 5.2 Scoring Algorithm

Implement:

```

similarity = 1 - (levenshtein\_distance / max\_length)

```



Accuracy thresholds:

\- ≥ 0.90 → Perfect  

\- 0.70–0.89 → Close  

\- < 0.70 → Incorrect  



Use token diffing for highlighting.



Update SRS ratings based on the score.



---



\# 6. COMPLETE PHRASE LIBRARY (expanded)



Output a JSON file using this structure:



```

{

&nbsp; "categories": \[

&nbsp;   {

&nbsp;     "id": "",

&nbsp;     "name": "",

&nbsp;     "phrases": \[

&nbsp;       { "it": "", "en": "" }

&nbsp;     ]

&nbsp;   }

&nbsp; ]

}

```



Include all the phrases below:



---



\## 6.1 Greetings \& Politeness

\- Buongiorno — Good morning  

\- Buonasera — Good evening  

\- Salve — Hello (polite)  

\- Ciao — Hi / Bye  

\- Arrivederci — Goodbye  

\- A dopo — See you later  

\- Per favore — Please  

\- Grazie mille — Thank you very much  

\- Prego — You’re welcome  

\- Mi scusi — Excuse me  

\- Non fa niente — It’s okay / No worries  

\- Parla inglese? — Do you speak English?  

\- Parlo poco italiano — I speak little Italian  

\- Può ripetere, per favore? — Can you repeat, please?  



---



\## 6.2 Transportation

\- Dov’è la stazione? — Where is the train station?  

\- Quanto costa un biglietto? — How much is a ticket?  

\- A che ora parte? — What time does it leave?  

\- A che ora arriva? — What time does it arrive?  

\- È questo il binario giusto? — Is this the right platform?  

\- Vorrei un biglietto per Roma — I’d like a ticket to Rome  

\- È incluso il posto? — Is the seat included?  

\- Dove devo scendere? — Where should I get off?  

\- Questo treno è diretto? — Is this train direct?  



---



\## 6.3 Food \& Dining

\- Un tavolo per due — A table for two  

\- Possiamo sederci fuori? — Can we sit outside?  

\- Il menù, per favore — The menu, please  

\- Che cosa consiglia? — What do you recommend?  

\- Vorrei questo — I’d like this  

\- Senza glutine — Gluten-free  

\- Senza lattosio — Lactose-free  

\- Sono allergico a… — I’m allergic to…  

\- Un litro di acqua naturale/frizzante — A liter of still/sparkling water  

\- Possiamo avere il conto? — Can we have the check?  

\- Separato, per favore — Separate checks  



---



\## 6.4 Hotels \& Check-In

\- Ho una prenotazione — I have a reservation  

\- A che ora è il check-out? — What time is check-out?  

\- C’è la colazione inclusa? — Is breakfast included?  

\- Posso lasciare i bagagli? — Can I leave my bags?  

\- Il Wi-Fi non funziona — The Wi-Fi isn’t working  

\- C’è un ascensore? — Is there an elevator?  

\- Vorrei un taxi, per favore — I’d like a taxi, please  



---



\## 6.5 Emergencies

\- Aiuto! — Help!  

\- Chiamate un’ambulanza! — Call an ambulance!  

\- Dov’è la farmacia più vicina? — Where is the nearest pharmacy?  

\- Ho bisogno di un medico — I need a doctor  

\- Mi sono perso — I’m lost  

\- Ho perso il mio portafoglio — I lost my wallet  

\- Mi fa male qui — It hurts here  



---



\## 6.6 Shopping \& Money

\- Quanto costa? — How much is it?  

\- È troppo caro — It’s too expensive  

\- Avete una taglia più grande/piccola? — Do you have a larger/smaller size?  

\- Posso provarlo? — Can I try it on?  

\- Posso pagare con carta? — Can I pay by card?  

\- Avete qualcosa di simile? — Do you have something similar?  



---



\## 6.7 Navigation \& Daily Use

\- Dov’è il bagno? — Where is the bathroom?  

\- È lontano? — Is it far?  

\- È vicino? — Is it close?  

\- A sinistra — To the left  

\- A destra — To the right  

\- Sempre dritto — Straight ahead  

\- Quanto tempo ci vuole? — How long does it take?  



---



\## 6.8 Social / Human Interaction

\- Va bene — Okay  

\- Perfetto — Perfect  

\- Nessun problema — No problem  

\- Di dove sei? — Where are you from?  

\- Come va? — How’s it going?  

\- Tutto bene — All good  



---



\# 7. DEPLOYMENT INSTRUCTIONS

Include in README:



```

npm install -g netlify-cli

netlify login

netlify init

netlify dev

netlify deploy --prod

```



---



\# 8. FINAL DELIVERABLES (Copilot must generate)



1\. Fully implemented app with dark mode and performance optimization  

2\. Complete spaced repetition engine (SM-2 inspired)  

3\. Clean, mobile-first UI  

4\. Fully operational speech recognition + scoring pipeline  

5\. Robust phrase library  

6\. Service worker for offline use  

7\. Readable documentation in README  



You must not use paid APIs or external servers.



The app must be production-ready and optimized for a traveler preparing for a real trip to Italy.



---



\# COPILOT: After generating the full app, perform a second pass of enhancements.



You must now audit everything you generated and perform a second-phase refinement pass with the following requirements:



---



\# 1. PERFORMANCE REFINEMENT



\## 1.1 Optimize load time

\- Inline critical CSS.

\- Lazy-load non-essential JS modules.

\- Minify all output (JS, CSS, SVGs).

\- Ensure the site scores \*\*90+ on Lighthouse performance\*\* for mobile.



\## 1.2 Efficient rendering

\- Replace any inefficient DOM loops.

\- Scope selectors to reduce layout thrashing.

\- Use passive event listeners where possible.

\- Cache DOM lookups.



\## 1.3 Network \& caching

\- Ensure service worker:

&nbsp; - Caches core assets aggressively.

&nbsp; - Uses stale-while-revalidate for JSON.

\- Verify offline mode fully works.

\- Preload fonts and required audio assets.



---



\# 2. DARK MODE POLISH

\- Ensure dark mode is the \*\*default theme\*\*.

\- Apply soft transitions between dark/light.

\- Use consistent elevation, shadow, and surface semantics.

\- Adjust for high-contrast readability.



---



\# 3. SRS ENGINE (SM-2+ REFINEMENT)



\## 3.1 Improve the learning algorithm

Upgrade the spaced repetition engine with:

\- \*\*Context-based difficulty\*\*: make longer phrases increase interval more slowly.

\- \*\*Decay rules\*\* for long absences.

\- \*\*Adaptive strictness\*\*: use historical accuracy to adjust similarity thresholds.



\## 3.2 Daily learning queue

Refactor to ensure:

\- Maximum 12–20 review cards per session.

\- Mix: 70% review, 30% new phrases.

\- Include a “learning streak” counter stored in localStorage.



---



\# 4. PRONUNCIATION FEEDBACK REFINEMENT



\### Implement:

\- More robust token diffing (prefix, suffix, vowel errors).

\- Special-case rules for:

&nbsp; - Italian double consonants (e.g., \*anno\* vs \*ano\*)

&nbsp; - Open vs closed vowels

&nbsp; - Elisions (\*l’acqua\*, \*un’amica\*)



\### Improve user messaging:

\- Give feedback in clear, actionable text.

\- Include IPA-like hints if available (generated locally, not via external APIs).



---



\# 5. ACCESSIBILITY IMPROVEMENTS

\- Ensure full keyboard navigation.

\- Add ARIA labels everywhere.

\- High-contrast toggle.

\- Font-size adjuster (saved in localStorage).



---



\# 6. UI/UX REFINEMENTS



\### Improvements to be made automatically:

\- Add subtle microanimations for buttons.

\- Smooth transitions between categories and cards.

\- Replace any placeholder icons with high-quality SVG.

\- Provide a polished onboarding flow explaining:

&nbsp; - How to use speech recognition

&nbsp; - How SRS works

&nbsp; - How progress is tracked



\### Add “Quick Review” mode:

\- 10 rapid-fire pronunciation checks.

\- Show summary with streak, accuracy, and SRS adjustments.



---



\# 7. EXPAND PRACTICAL PHRASES

Add phrases for:

\## Coffee culture

\- Un espresso — An espresso  

\- Un macchiato — A macchiato  

\- Un cappuccino — A cappuccino  

\- Da portare via — To go / take away  



\## Train stations

\- È in orario? — Is it on time?  

\- C’è un supplemento? — Is there a surcharge?  

\- Il binario è cambiato — The platform has changed  



\## Restaurants

\- Siamo in ritardo — We’re running late  

\- Arriviamo tra dieci minuti — We’ll arrive in 10 minutes  

\- È piccante? — Is it spicy?  

\- È possibile dividere? — Is it possible to split (the dish)?  



\## Hotels

\- È possibile un check-out tardivo? — Is late check-out possible?  

\- C’è aria condizionata? — Is there air conditioning?  



\## Useful everyday

\- Funziona? — Does it work?  

\- Mi può aiutare? — Can you help me?  

\- Sto solo guardando — I’m just looking  



---



\# 8. CODE MAINTAINABILITY IMPROVEMENTS



Copilot must:

\- Refactor repetitive DOM code into utility functions.

\- Organize JS modules by domain:

&nbsp; - UI

&nbsp; - state

&nbsp; - recognition

&nbsp; - scoring

&nbsp; - SRS

\- Add JSDoc-style comments for all public functions.

\- Ensure the codebase is readable and scalable.



---



\# 9. FINAL QA PASS



Copilot must validate:

\- No console errors.

\- No unhandled Promise rejections.

\- App functions correctly in:

&nbsp; - Chrome (required)

&nbsp; - Safari (best effort)

\- Speech recognition timeouts behave gracefully.



---



\# 10. OPTIONAL EXTRA CREDIT



If implementation complexity is low, add:

\- App icon \& splash screen

\- Add-to-home-screen (A2HS) support

\- Simple Italian number trainer (1–1000)

\- Irregular verb quick references (avere, essere, andare, venire)



---



\# 11. OUTPUT INSTRUCTIONS



Copilot must:

\- Apply all these refinements to the existing codebase.

\- Submit the revised, optimized, polished project.

\- Update the README to reflect the enhanced functionality.



You must ensure everything remains:

\- 100% free

\- 100% client-side

\- 100% deployable on Netlify

