# Poco a Poco

An offline Spanish trainer for phones: recall-the-word flashcards with spaced repetition, and a listening trainer that plays sentences slow, steady, then natural, with word-count blanks, dictation, and marks where sounds run together.

- Use it: the GitHub Pages site serves `docs/`. Open it in Safari, Share → Add to Home Screen, and it works offline after that.
- Source: `src/deck.txt` (the word deck), `src/head.html` (layout and styles), `src/app.js` (flashcards, listening, speech).
- Build: `python3 src/build.py` writes `app.html` (claude.ai artifact) and `docs/` (home-screen web app). `python3 src/make_icons.py` redraws the icons.
