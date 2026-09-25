/* =========================================================================
   ⚙️  CONFIG — this is the ONLY block you edit per order / per customer.
   =========================================================================
   HOW STORAGE WORKS
   - Bucket:  files-main            (must be , or use signed URLs — see note below)
   - Path:    birthday-surprises/<customerId>/<filename>
   - Example: birthday-surprises/xyz123/W1.jpg

   To sell this to many people: keep ONE deployment, and hand each buyer a
   link like  yoursite.com/?id=xyz123  — the id in the URL overrides
   CONFIG.customerId below, so you never touch the code again after the
   first setup. Only the text fields (names/letter/reasons) need editing
   per order, OR you can move those into a Supabase table later.
   ========================================================================= */
window.CONFIG = {
  // --- Supabase project ---
  supabaseUrl: "https://cvsayoccmdksomajoalu.supabase.co", // <-- 1) put your real project URL here
  supabaseAnonKey: "sb_publishable_kYT-6Tvgjcl2wmcHbZRuaw_if40dy9D",
  bucket: "files-main",
  basePath: "birthday-surprises",
  customerId: "xyz123",   // <-- 2) default customer, overridden by ?id=... in the URL

  // --- people ---
  friendName: "Cutie",              // shown on the final page
  senderSign: "— your forever friend",

  // --- assets living inside the customer folder ---
  songFile: "song1.mp3",
  finalPhoto: "Special.jpg",
  albums: {
    good:  { prefix: "W", count: 5, ext: "jpg" }, // Page 4 — The Good Times
    chaos: { prefix: "M", count: 5, ext: "jpg" }, // Page 5 — The Chaos
    adv:   { prefix: "O", count: 5, ext: "jpg" }, // Page 6 — Our Little Adventures
    silly: { prefix: "S", count: 5, ext: "jpg" }, // Page 7 — The Silly Side
  },
  // Page 8 "Little Things" collage reuses a few photos already uploaded
  // (edit these if you upload dedicated little-things photos instead)
  collagePhotos: ["W5", "M3", "O5", "S5"],
  // Page 10 "Our Forever" background photo (pick your favourite adventure shot)
  foreverPhoto: "O3",

  // --- branding (for selling — small, tasteful credit + upsell link) ---
  showBranding: true,
  brandName: "Made with 💌 Surprizyy",
  brandLink: "Surprizyy.com",

  // --- the letter (page 2) ---
  letterTitle: "Happy Birthday, {{friendName}}. ❤️",
  letterBody: [
    "I don't know if I say it enough, but I'm genuinely lucky to have you in my life.",
    "We've had so many random conversations, stupid moments, laughs, memories and completely unnecessary chaos…",
    "and honestly, I wouldn't replace any of it.",
    "So today I wanted to give you something a little different — not just a birthday wish, but a tiny collection of memories, nonsense, and reasons why you're such an important person to me.",
  ],
  letterClosing: "Happy Birthday, idiot. 😂❤️",
  letterFooter: "Now go explore.",

  // --- reasons page (page 9) ---
 reasons: [
  "kind heart",
  "crazy sense of humor",
  "always there",
  "big dreams",
  "so supportive",
  "you just get me"
],
};
