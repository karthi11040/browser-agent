import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Forge — Web Automation Agent",
  description:
    "Give the agent a prompt. It plans, searches the web, reads pages, reasons, and composes a structured answer.",
  keywords: ["AI agent", "web automation", "autonomous agent", "Next.js", "Z.ai"],
  authors: [{ name: "Agent Forge" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

// Inline script that runs synchronously when parsed (no async/defer) and
// strips known browser-extension attributes (bis_*, __processed_*) from the
// DOM BEFORE React hydrates. Browser security extensions like Bitdefender's
// Identity Shield inject `bis_skin_checked="1"` and similar attributes into
// many elements after parsing but before hydration, which causes React to
// warn about attribute mismatches. We also set up a MutationObserver to
// catch any attributes the extension adds later (after our initial walk).
//
// `suppressHydrationWarning` on <body> only covers that single element —
// it doesn't cascade to descendants — so this script is what actually
// prevents the deep-div warnings.
const EXTENSION_ATTR_STRIPPER = `
(function() {
  var PREFIXES = ['bis_', '__processed'];

  function isExtAttr(name) {
    if (!name) return false;
    for (var i = 0; i < PREFIXES.length; i++) {
      if (name.indexOf(PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function stripAttrs(el) {
    if (!el || !el.attributes || el.attributes.length === 0) return;
    var toRemove = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var name = el.attributes[i].name;
      if (isExtAttr(name)) toRemove.push(name);
    }
    for (var j = 0; j < toRemove.length; j++) {
      el.removeAttribute(toRemove[j]);
    }
  }

  function walk(node) {
    if (!node || node.nodeType !== 1) return;
    stripAttrs(node);
    var children = node.children;
    if (children) {
      for (var i = 0; i < children.length; i++) {
        walk(children[i]);
      }
    }
  }

  function startObserver() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    var obs = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' && m.target) {
          stripAttrs(m.target);
        } else if (m.type === 'childList' && m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            if (m.addedNodes[j].nodeType === 1) walk(m.addedNodes[j]);
          }
        }
      }
    });
    // Don't pass attributeFilter — we want to observe ALL attribute changes
    // and check the prefix inside the callback (MutationObserver doesn't
    // support prefix-based filtering).
    obs.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  function tryInit() {
    if (document.body) {
      walk(document.body);
      startObserver();
      return true;
    }
    return false;
  }

  if (!tryInit()) {
    // Body not yet parsed — try again on the next microtask, before any
    // React hydration script can run.
    Promise.resolve().then(tryInit);
    document.addEventListener('readystatechange', tryInit);
    document.addEventListener('DOMContentLoaded', tryInit);
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: EXTENSION_ATTR_STRIPPER }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
