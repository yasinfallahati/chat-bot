<p align="center"><img src="assets/hero.png" width="100%" alt="Chat Bot"></p>

# Chat Bot — browser OpenAI desk

<p align="center">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
<img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white">
<img src="https://img.shields.io/badge/Streaming-10B981?style=for-the-badge">
<img src="https://img.shields.io/badge/DALL·E-0F172A?style=for-the-badge">
</p>

<p align="center"><img src="assets/screenshot.png" width="100%" alt="Chat UI screenshot"></p>

**No Node server required for the UI.** Drop `gpt-chat/` behind any static host (or `python -m http.server`), paste your API key in Settings, and you get streaming chat + image mode with conversation history in `localStorage`.

## Quick start

```bash
cd gpt-chat
python3 -m http.server 8000
# open http://localhost:8000 — set API key in Settings
```

## Product surface

| Control | Role |
|---------|------|
| Sidebar | Conversation list, new chat, backup import/export |
| Mode select | `گفتگو` (chat) · `تولید تصویر` (image) |
| Settings | API key + endpoint knobs (stay local to the browser) |

Persian-first chrome (`dir=rtl`). Prefer this repo over the empty **chat-bot-** archive.

---

## فارسی — چت‌بات مرورگری

رابط تک‌صفحه‌ای برای **گفتگوی استریم OpenAI** و **تولید تصویر**؛ تاریخچه در `localStorage`، پشتیبان JSON، و تنظیمات API داخل خود مرورگر. بدون بک‌اند اختصاصی برای UI.

### شروع سریع

```bash
cd gpt-chat && python3 -m http.server 8000
```

سپس کلید API را از منوی تنظیمات وارد کنید.

### تفاوت با chat-bot-

ریپوی `chat-bot-` فقط اسکلت قدیمی است؛ **اینجا** UI کامل مرورگر قرار دارد.
