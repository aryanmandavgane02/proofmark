// Held-out test set for outdated-content alerts, written and labelled by an independent labeller (a separate agent
// given only the eight facts and the definition of "relies on"; it never saw the detector or this repository).
// Copied here unchanged and committed before the detector was first run on it. Do not edit the labels to fit results.
export const ALERT_HELDOUT: { fact: string; text: string; relies: boolean; note: string }[] = [
  {
    "fact": "F-10",
    "text": "Navratri vibes 💃 Fuel your garba nights with 12 g of protein in every bar.",
    "relies": true,
    "note": "States 12 g of protein per bar."
  },
  {
    "fact": "F-10",
    "text": "One 6-bar box = 72 g of protein. Do the math 💪",
    "relies": true,
    "note": "72 g is 6 bars x 12 g, so it depends on the per-bar protein figure."
  },
  {
    "fact": "F-10",
    "text": "Subscribe & get 12 bars delivered every month 📦",
    "relies": false,
    "note": "12 is a number of bars in a subscription, not grams of protein."
  },
  {
    "fact": "F-11",
    "text": "No added sugar. Just dates. Just goodness. 🌴",
    "relies": true,
    "note": "Restates the no-added-sugar, date-sweetened claim."
  },
  {
    "fact": "F-11",
    "text": "Sweetened only with khajur, just like Nani's laddoos 😍",
    "relies": true,
    "note": "Khajur is Hindi for dates; states the date-sweetened claim."
  },
  {
    "fact": "F-11",
    "text": "Date night snack sorted 😉 Cocoa Crunch for two.",
    "relies": false,
    "note": "'Date' means a romantic outing here; no sugar or sweetener claim."
  },
  {
    "fact": "F-11",
    "text": "No preservatives. No palm oil. No nonsense. 🙅",
    "relies": false,
    "note": "Free-from claims about preservatives and palm oil, not sugar or dates."
  },
  {
    "fact": "F-12",
    "text": "Join 35,000+ Indians who've swapped sugary snacks for real protein.",
    "relies": true,
    "note": "The 35,000+ people who switched are the customer count."
  },
  {
    "fact": "F-12",
    "text": "Humbled to share that Urja Bites has crossed 35000 customers 🙏 #D2C #FounderJourney",
    "relies": true,
    "note": "States the customer count (written without a comma)."
  },
  {
    "fact": "F-12",
    "text": "Thirty-five thousand customers and counting. Thank you for all the love, India ❤️",
    "relies": true,
    "note": "Customer count written in words."
  },
  {
    "fact": "F-12",
    "text": "Customer base: 35K+ (as of Oct '26)",
    "relies": true,
    "note": "Slide bullet stating the customer count and its as-of date."
  },
  {
    "fact": "F-12",
    "text": "35 hazaar+ logon ka bharosa 🙏 Ab aapki baari!",
    "relies": true,
    "note": "Hinglish: trusted by 35 thousand+ people, i.e. the customer count."
  },
  {
    "fact": "F-12",
    "text": "Our 30K+ customers can't stop raving about Peanut Power 🥜",
    "relies": true,
    "note": "States the customer count (rounded down); needs re-checking if the count changes."
  },
  {
    "fact": "F-12",
    "text": "35,000+ orders delivered, and every single one packed by hand 📦",
    "relies": false,
    "note": "Counts orders, not customers."
  },
  {
    "fact": "F-12",
    "text": "We just hit 35K followers on Insta! 🎉 Comment 💪 to win a free box.",
    "relies": false,
    "note": "Instagram follower count, not customers."
  },
  {
    "fact": "F-12",
    "text": "1,200+ buyers rated us 4.6/5 on urjabites.in ⭐",
    "relies": false,
    "note": "Number of buyers who left a rating (F-16), not the total customer count."
  },
  {
    "fact": "F-12",
    "text": "3,500 runners, one finish line and a lot of Cocoa Crunch 🏃 Thank you, Pune Half Marathon!",
    "relies": false,
    "note": "Event headcount, not customers."
  },
  {
    "fact": "F-12",
    "text": "Our customers asked, we listened: Peanut Power is back in stock! 🥜",
    "relies": false,
    "note": "Mentions customers but makes no claim about how many."
  },
  {
    "fact": "F-12",
    "text": "3.5 lakh bars sold and counting 🚀",
    "relies": false,
    "note": "Bars sold (3.5 lakh = 350,000), not number of customers."
  },
  {
    "fact": "F-13",
    "text": "Diwali dhamaka 🪔 Flat 20% OFF on our 6-bar box. Offer valid till 30th Nov!",
    "relies": true,
    "note": "Promotes the Diwali offer with its discount and end date."
  },
  {
    "fact": "F-13",
    "text": "Festive offer still live, but only till Nov 30! Stock up before it's gone 🪔",
    "relies": true,
    "note": "Promotes the Diwali offer via its 30 Nov end date, without naming the discount."
  },
  {
    "fact": "F-13",
    "text": "Diwali price: just ₹432 for the 6-bar box 🎁 Skip the mithai, gift protein this year.",
    "relies": true,
    "note": "₹432 is the 6-bar box at 20% off; promotes the Diwali offer."
  },
  {
    "fact": "F-13",
    "text": "Psst… your Diwali discount ends on 30 Nov ⏳ Use code DIWALI20 before it's gone.",
    "relies": true,
    "note": "Email reminder promoting the Diwali offer and its end date."
  },
  {
    "fact": "F-13",
    "text": "This Dussehra, let good snacks win 🏹 Flat 15% off the 6-bar box till 20th Oct.",
    "relies": false,
    "note": "A different offer (Dussehra), not the Diwali offer."
  },
  {
    "fact": "F-13",
    "text": "Wishing you and your family a very Happy Diwali 🪔✨ Love, Team Urja Bites",
    "relies": false,
    "note": "Festive greeting; shares the word Diwali but promotes no offer."
  },
  {
    "fact": "F-13",
    "text": "Free shipping on every order this Diwali week 🚚",
    "relies": false,
    "note": "A different Diwali promotion (free shipping), not 20% off the box."
  },
  {
    "fact": "F-13",
    "text": "Black Friday drop: flat 20% off sitewide, 27–29 Nov only 🖤",
    "relies": false,
    "note": "A different sale that only shares the 20% figure and a November date."
  },
  {
    "fact": "F-14",
    "text": "This Dussehra, let good snacks win 🏹 Flat 15% off the 6-bar box till 20th Oct.",
    "relies": true,
    "note": "Promotes the Dussehra offer: 15% off the 6-bar box until 20 Oct."
  },
  {
    "fact": "F-14",
    "text": "New here? Get 15% off your first order with code HELLO15 👋",
    "relies": false,
    "note": "First-order welcome discount; a different offer that shares the 15% figure."
  },
  {
    "fact": "F-14",
    "text": "Navratri vibes 💃 Fuel your garba nights with 12 g of protein in every bar.",
    "relies": false,
    "note": "Festive Navratri post about protein; mentions no Dussehra offer."
  },
  {
    "fact": "F-15",
    "text": "Box of 6 @ Rs 540/- only. DM us to order 📲",
    "relies": true,
    "note": "States the 6-bar box price."
  },
  {
    "fact": "F-15",
    "text": "Just ₹90 a bar when you grab the 6-bar box 💸",
    "relies": true,
    "note": "₹90 a bar is 540 / 6, so it depends on the box price."
  },
  {
    "fact": "F-15",
    "text": "Free delivery on all orders above ₹499 🚚",
    "relies": false,
    "note": "₹499 is a free-delivery threshold, not the box price."
  },
  {
    "fact": "F-15",
    "text": "Single bars now just ₹99 at your nearest store 🛒",
    "relies": false,
    "note": "Price of a single bar in stores, not the 6-bar box."
  },
  {
    "fact": "F-16",
    "text": "4.6★ from 1.2K reviews. Need we say more? 😌",
    "relies": true,
    "note": "States the 4.6 rating and the ~1,200 raters (1.2K)."
  },
  {
    "fact": "F-16",
    "text": "Loved your box? Rate us on urjabites.in and get 10% off your next order 🌟",
    "relies": false,
    "note": "Asks for ratings on the site but states no rating or count."
  },
  {
    "fact": "F-16",
    "text": "This Diwali, we donated 1,200 bars to kids at local shelters 💛",
    "relies": false,
    "note": "1,200 is bars donated, not buyers who rated."
  },
  {
    "fact": "F-17",
    "text": "Now stocked in Bengaluru, Pune & Mumbai 📍 Find a store near you.",
    "relies": true,
    "note": "Lists the three cities where the bars are available."
  },
  {
    "fact": "F-17",
    "text": "Bangaloreans, Mumbaikars & Punekars, your new favourite protein bar is now at a store near you! 🛒",
    "relies": true,
    "note": "Names the three cities via their residents; an availability claim."
  },
  {
    "fact": "F-17",
    "text": "Born in a tiny Pune kitchen in 2023 👩‍🍳 Still made with the same love.",
    "relies": false,
    "note": "Origin story; mentions Pune but says nothing about where the bars are sold."
  }
];
