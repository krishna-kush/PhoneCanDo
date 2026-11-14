# Field Notes: what is left

A mock nature documentary about the crew inside a phone. A solemn narrator
makes a claim in each shot, the crew proves him wrong and fixes his caption
by hand, and the red italic fix is the film's real claim. 48 seconds, 16:9,
all in the site's white theme.

## Where it stands (2026-11-14)

It is a rough cut: every shot is there with its real timing, captions,
fixes and its own score, but the drawing and the acting are blocking, not
final art. It rendered once at full size (`out/field-notes/field-notes-16x9.mp4`,
not in git). Nobody has listened to the score yet.

It is parked. The intro we publish for now is the first one, made by
`video/`, the package `videos/` replaced: its code is in git history, in
the commit before `videos/` was added. We either finish this film later or
try another concept in a new folder beside it.

## Not done

Picture:
- [ ] The caption fixes are all one gag (a unit runs under the wrong word,
      the right one drops in). Each was meant to differ: "alone" carried
      off, "no tools" dropped through a hatch and "a whole Linux" up on a
      lift, "you" lowered in on a rope, "cannot" flattened by the last DONE
      stamp, "no" shaken off by the bass.
- [ ] The song and dawn views are too small: the phone sits mid-frame with
      empty page either side and tiny units. The song should be the best
      part.
- [ ] The acting is basic: everyone hops, walks and bobs alike. The pile-up
      at the gate, the cheer, the dance and the scramble need moves of
      their own, and at the ladder the units run through one another.
- [ ] The chores are stand-ins: a result chip and a stamp appear, nobody is
      seen doing the chore.
- [ ] The rooms are bare boxes with few props.
- [ ] The name tags are small and quick, hard to read on a phone.
- [ ] The first frame, which feeds show before the video plays, is a grey
      room of sleepers; it may not stop a scroll.
- [ ] Night reads only from the grey rooms and the clock.
- [ ] The fingerprint is a simple arch pattern, not a convincing print.

Sound:
- [ ] Listen to the score and tune it by ear. Its composer's doubts: the
      night ticks may be too quiet on a phone speaker, the fingerprint scan
      too loud straight after the silence, and every instrument's tone was
      chosen by theory.
- [ ] Try an AI narrator on the cut; keep it, swap in a human read on the
      same slots, or drop it. The narrator's reed tune has its own track
      (`narrator`) to mute if a voice comes in.

Formats:
- [ ] The vertical (9:16) and square (1:1) versions.
- [ ] A thumbnail.

To decide:
- [ ] Whether the name tags show the real agent names, as the site's cards
      do, or stay blank.

## Or another concept

Two other concepts: "One Take" (no words, one
phone in one shot, the crew's work makes the music) and "Skip Intro" (A-01
gets bored of a dull corporate video and uses it like a phone).

## Picking it up

```sh
pnpm -C videos studio                                # play it with a timeline
pnpm -C videos stills field-notes --strip gate..gate+8   # a move as one picture
pnpm -C videos sound field-notes                     # the score and effects again
pnpm -C videos render field-notes --draft            # the whole film, half size
```

Every beat something happens on is in `script/moments.ts`; the picture, the
effects and the score all read it, so retiming a gag there retimes all
three. The narrator's lines and their fixes are in `script/lines.ts`.
