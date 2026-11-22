// Approved sample content seeded into every demo workspace, labelled "Sample" in the app. It is what outdated-content
// alerts (Round 3, improvement 2) protect: posts, emails and a deck that quote facts in different forms ("35,000+
// customers", "35k customers", "over 35,000 happy customers", "35,000 families"), offers, and decoys that must not
// raise an alert ("1,200 buyers" belongs to the rating fact; "3,500 bars" is not about customers).
// `relies` is the hand label used by the scored test set (eval/run.ts): the facts each item quotes or names.
import type { Channel } from "@/lib/checks/types";
import deck from "./library-deck.json";

export type LibraryItem = {
  key: string; title: string; channel: Channel; body: string; alt_text: string;
  owner: "Arjun" | "Meera"; approver: "Meera" | "Ritu"; approved_on: string; document?: true; relies: string[];
};

export const LIBRARY_DECK = deck as {
  file: string; hash: string; size: number; pageCount: number; body: string;
  pages: { n: number; start: number; end: number; fonts: { family: string; font: string; chars: number }[]; runs: { family: string; start: number; end: number }[] }[];
};

export const LIBRARY: LibraryItem[] = [
  {
    key: "lib-about", title: "About us page", channel: "website", owner: "Arjun", approver: "Meera", approved_on: "2026-11-02", relies: ["F-12", "F-17"], alt_text: "",
    body: "Urja Bites started in a Pune kitchen with three ingredients: cocoa, peanuts and dates. Today 35,000+ customers in Bengaluru, Pune and Mumbai snack on our bars. Order a box at urjabites.in.",
  },
  {
    key: "lib-thanks", title: "Thank-you post", channel: "instagram", owner: "Arjun", approver: "Meera", approved_on: "2026-11-05", relies: ["F-12"],
    body: "35k customers and counting. Thank you for every bite of cocoa, peanuts and dates. #UrjaBites #ThankYou",
    alt_text: "A stack of Cocoa Crunch bars on a cream plate next to a handwritten thank-you note.",
  },
  {
    key: "lib-welcome", title: "Welcome email", channel: "email", owner: "Arjun", approver: "Meera", approved_on: "2026-11-06", relies: ["F-12"], alt_text: "",
    body: "Subject: Welcome to Urja Bites\n\nHi there,\n\nYou just joined over 35,000 happy customers who snack on real cocoa, peanuts and dates. Find your favourite bar at urjabites.in.\n\nTeam Urja",
  },
  {
    key: "lib-milestone", title: "Milestone post", channel: "linkedin", owner: "Meera", approver: "Ritu", approved_on: "2026-11-08", relies: ["F-12", "F-17"], alt_text: "",
    body: "Roasted cocoa, peanuts and dates won over 35,000 families this year. Thank you to everyone in Bengaluru, Pune and Mumbai who made us part of their day. #UrjaBites",
  },
  {
    key: "lib-deck", title: "Diwali retail deck (approved)", channel: "document", document: true, owner: "Arjun", approver: "Meera", approved_on: "2026-11-12",
    relies: ["F-10", "F-11", "F-12", "F-13", "F-15", "F-16", "F-17"], alt_text: "", body: LIBRARY_DECK.body,
  },
  {
    key: "lib-diwali-email", title: "Diwali offer email", channel: "email", owner: "Arjun", approver: "Meera", approved_on: "2026-11-10", relies: ["F-13"], alt_text: "",
    body: "Our Diwali box is here: six bars of cocoa, peanut and date goodness. Get 20% off the 6-bar box until 30 November. T&C apply. Order at urjabites.in.",
  },
  {
    key: "lib-diwali-post", title: "Diwali table post", channel: "instagram", owner: "Arjun", approver: "Meera", approved_on: "2026-11-10", relies: ["F-13"],
    body: "Roasted cocoa and dates for your Diwali table. 20% off the 6-bar box until 30 November. T&C apply. #UrjaBites",
    alt_text: "A festive box of six Urja Bites bars beside a lit diya.",
  },
  {
    key: "lib-dussehra", title: "Dussehra offer post", channel: "instagram", owner: "Arjun", approver: "Meera", approved_on: "2026-10-02", relies: ["F-14"],
    body: "Cocoa, dates and a festive crunch. Enjoy 15% off the 6-bar box this Dussehra. T&C apply. #UrjaBites",
    alt_text: "A Peanut Power bar resting on a marigold garland.",
  },
  // Decoys for the customer count and the offers.
  {
    key: "lib-peanut", title: "Product page: Peanut Power", channel: "website", owner: "Arjun", approver: "Meera", approved_on: "2026-10-20", relies: ["F-10", "F-11", "F-15"], alt_text: "",
    body: "Peanut Power is roasted peanuts, dates and a pinch of cardamom. Each bar has 12 g of protein and no added sugar. A box of six costs ₹540. Order a box at urjabites.in.",
  },
  {
    key: "lib-ratings", title: "Ratings post", channel: "instagram", owner: "Arjun", approver: "Meera", approved_on: "2026-11-03", relies: ["F-16"],
    body: "Rated 4.6 out of 5 by 1,200 buyers on urjabites.in. Thank you for every review. #UrjaBites",
    alt_text: "Five gold stars above a Cocoa Crunch bar on a cream background.",
  },
  {
    key: "lib-kitchen", title: "Kitchen story", channel: "linkedin", owner: "Meera", approver: "Ritu", approved_on: "2026-11-04", relies: [], alt_text: "",
    body: "Our Pune kitchen bakes 3,500 bars every morning from roasted cocoa, peanuts and dates. #UrjaBites",
  },
];
