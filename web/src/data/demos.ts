// Demo gallery. Add a phone recording by dropping the files in
// public/demos/ and filling video + poster — nothing else to touch.
// Media spec: 720x1560 (9:19.5), H.264, muted, <=3 MB, 6-10 s loop.
export type Demo = {
  slug: string;
  title: string;
  tags: string[];
  video?: string;
  poster?: string;
};

export const demos: Demo[] = [
  { slug: 'reply', title: 'Reply to the last message', tags: ['read screen', 'tap', 'send'] },
  { slug: 'order', title: 'Order your usual', tags: ['tap', 'cart', 'checkout'] },
  { slug: 'twofa', title: 'Copy the 2FA code', tags: ['screen', 'clipboard'] },
  { slug: 'summarize', title: 'Summarise what’s on screen', tags: ['screenshot', 'model'] },
  { slug: 'battery', title: 'Battery low? Turn on saver', tags: ['settings', 'intent'] },
  { slug: 'ride', title: 'Book the cheapest ride', tags: ['apps', 'compare', 'tap'] },
  { slug: 'slack', title: 'Post this screenshot to Slack', tags: ['share', 'intent'] },
  { slug: 'silence', title: 'Silence it until 9', tags: ['dnd', 'system'] },
];
