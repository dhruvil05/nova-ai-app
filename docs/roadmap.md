# Roadmap

Nova will have four tabs: **AI**, **Notes**, **Music** and **Files**. The AI tab is the hub; the assistant reaches the others only through tools. Build phases follow the product spec.

| Phase | Scope | Status |
| --- | --- | --- |
| 1. Skeleton and Notes | Tabs, database and migrations, Notes list, editor and search, private notes behind fingerprint unlock, Settings | Done |
| 2. Music | Device library and imports, player, background and lock-screen playback | Not started |
| 3. Files | Import PDF, DOCX and TXT, extract their text for the AI | Not started |
| 4. AI chat with tools | Provider wrapper, agent loop, tool cards, confirmations | Done except the Music and Files tools, which wait for those tabs |
| 5. In-app voice | Speech to text, text to speech, hands-free mode | Not started |
| 6. Lock-screen voice | "Hey Nova" wake word in a native foreground service | Not started |
| 7. Polish | Database encryption, backups, RAG for large files, OCR, widgets | Not started |

## Coming next

- **Music**: device library and imports, player screen, background and lock-screen controls. Tools: `search_music`, `play_music`, `control_playback`, `now_playing`.
- **Files**: import PDF, DOCX and TXT, extract their text, view and share them, save AI-written text as files. Tools: `list_files`, `read_file`, `save_file`.
- **In-app voice**: a mic button, hands-free conversation, music ducking; English, Hindi and Gujarati.
- **Lock-screen voice**: a Kotlin wake-word service (Porcupine) that starts the assistant with the screen off.
- **Later**: database encryption, backups, RAG and OCR for large or scanned files, conversation summaries, widgets, offline AI, iOS.
