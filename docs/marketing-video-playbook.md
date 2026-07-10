# Marketing video playbook

This is the shared production system for Billion's daily Instagram campaign. The goal is one accurate, recognizably human Reel every day—not a stream of generic AI videos.

The default format is a **30–45 second, face-led bill explainer**. A teammate speaks to camera, Billion and official-source recordings supply the evidence, and the editing pipeline handles vertical framing, timed captions, cutaways, branding, audio normalization, and export.

## The default Reel

| Time      | Picture                                                   | What to say                                                                                                 |
| --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0:00–0:03 | Presenter, looking into the lens                          | Lead with the concrete consequence—not the bill number.                                                     |
| 0:03–0:08 | Billion app recording                                     | Identify the bill, jurisdiction, status, and “as of” date.                                                  |
| 0:08–0:28 | Presenter alternating with app proof and approved visuals | Explain two or three effects in plain English. Change the visual every 2–4 seconds.                         |
| 0:28–0:38 | Presenter or a simple comparison graphic                  | Give the most important caveat: what the bill does **not** mean, who is excluded, or what must happen next. |
| 0:38–0:45 | Presenter, then the generated end card                    | Ask for one action: save, share, comment with a question, or read the source in Billion.                    |

Do not simply read the bill. Translate it, compare it with the current rule, identify uncertainty, or explain why it matters. Meta's current originality guidance rewards meaningful new information or analysis and can deprioritize low-value narration of existing material. Instagram also reports that recommendations increasingly favor original posts. See [Meta's originality guidance](https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/) and [Instagram's 2026 product update](https://about.fb.com/news/2026/01/2026-ai-drives-performance/).

The 30–45 second length and 2–4 second visual rhythm are starting hypotheses, not Instagram rules. Test them against shorter cuts and let retention, saves, and shares decide.

## Formats to rotate through the month

| Format                      | Length | Repeatable hook                                   | Best use                             |
| --------------------------- | -----: | ------------------------------------------------- | ------------------------------------ |
| The bill in 45 seconds      | 30–45s | “This bill could change…”                         | Daily workhorse and broad explainers |
| Wait, that's in the bill?   | 15–25s | “Buried in this bill is…”                         | One surprising, verifiable clause    |
| Who gains / who pays?       | 25–40s | “Here is who gets the benefit—and who pays.”      | Fiscal or eligibility changes        |
| Myth versus text            | 20–35s | “You may have heard X. The bill actually says Y.” | Correcting a circulating claim       |
| Three taps to understand it | 20–35s | “Here is how to check this yourself.”             | Product-led app walkthrough          |
| Comment response            | 15–40s | Show the real comment, then answer it             | Community building and follow-ups    |

For a month-long campaign, start with approximately 50% “bill in 45 seconds,” 20% surprising-clause videos, 15% myth-versus-text, 10% product walkthroughs, and 5% experiments. This mix is a campaign hypothesis; adjust it weekly.

Use [Trial Reels](https://about.fb.com/news/2024/12/trial-reels-try-content-non-followers-first-see-what-perfoms-best/) for format experiments when the account has access. Trial Reels are shown to non-followers first, expose early metrics after about 24 hours, and can be configured to share successful trials more broadly.

## Before recording: research and script

### 1. Create the evidence sheet

Record these facts before writing:

- exact bill number and title;
- jurisdiction;
- current status and an **as of YYYY-MM-DD** date;
- the official text URL;
- sponsor and latest action, when relevant;
- two or three changes the text would make;
- one important exception, uncertainty, or next step;
- the affected group and whether the effect is proposed, enacted, blocked, or pending;
- the source and usage rights for every non-Billion visual.

Never call a proposal “the law” unless it is in force. When the text, Billion summary, and another source disagree, stop and resolve the discrepancy before recording.

### 2. Write for speech

Aim for 85–120 spoken words. Use this template:

```text
HOOK: [Concrete consequence or surprising question.]

IDENTITY: This is [bill number] in [jurisdiction]. As of [date], it is [status].

CHANGE 1: Today, [current rule]. The bill would [new rule].

CHANGE 2: That matters because [specific affected group and consequence].

CAVEAT: This does not mean [likely misconception]. [What still has to happen.]

CTA: [Save/share/comment/read in Billion—choose one.]
```

Read it aloud once. Replace legal terms with ordinary words, shorten sentences that require a second breath, and verify every number and proper noun. Keep the bill number on screen even if saying it would weaken the opening hook.

## Record the Billion screen

Use the production app and a clean demo account. Never record a personal address, email, notification, password, or private account data.

1. Turn on Do Not Disturb and close unrelated apps.
2. Set the phone to portrait, use the normal display zoom, and raise brightness enough that the screen is readable.
3. Open the exact bill or source before starting the recording.
4. Start iOS Screen Recording from Control Center with the microphone **off**. The presenter's camera recording supplies the final audio.
5. Hold for two seconds before the first action.
6. Move deliberately: one tap, one pause, one scroll. Pause 1–2 seconds on the title, status, major claim, source link, and any two-sided explanation.
7. Record 10–20 seconds more than needed. Hold for two seconds at the end.
8. Watch the recording once and confirm that text is sharp and no private data appeared.

Useful captures are the bill card, plain-language summary, original text or source link, status/date, and any pro/con or “both sides” treatment. Do not record random scrolling; every clip should prove something being said.

## Record the presenter

### Setup

- Record vertical at 4K/30 or 1080p/30. The final export is 1080×1920 at 30 fps.
- Put the lens at eye level and frame from mid-chest upward. Leave some room above the head for the hook.
- Face a window or soft key light. Avoid a bright window behind the presenter.
- Use a quiet, soft room. A wired or wireless lavalier microphone 6–8 inches from the mouth is ideal; a phone 2–3 feet away is acceptable.
- Clean the lens, enable the grid, lock focus/exposure when possible, and look at the lens rather than at your own preview.
- Wear solid, nonpartisan colors. Avoid small stripes, candidate/party material, and noisy jewelry.

### Performance

1. Say the whole script once without stopping, even if there is a small stumble.
2. Record the hook three ways: direct, curious, and urgent-but-not-alarmist.
3. Record one clean pickup for every factual mistake.
4. Pause briefly between sections. Those pauses give the automatic editor clean visual transitions.
5. Keep natural facial expression and hand movement. Do not imitate an AI voice cadence.
6. Record one alternate CTA.

The pipeline intentionally does not synthesize the presenter or publish automatically. The recognizable teammate and final human review are part of the product's trust model.

## Organize the files

Use one project directory per Reel:

```text
video-projects/2026-07-10-renter-bill/
├── project.json
├── script.md
├── input/
│   ├── presenter.mov
│   ├── app-screen-recording.mov
│   └── captions.srt             # optional when Gemini transcription is enabled
├── assets/
│   └── approved-visual.jpg
└── output/                      # generated
```

Raw video, local assets, and rendered output are gitignored. Keep the approved script and project recipe in version control when useful.

File names should describe the content, not `IMG_1234`. Keep original recordings; do not repeatedly export and recompress them.

## Automatic editing pipeline

The pipeline lives in [`packages/social-media-agent`](../packages/social-media-agent/). It uses Sharp and FFmpeg, so it does not depend on CapCut or a particular desktop editor.

### One-time setup

From the repository root:

```sh
pnpm install
brew install ffmpeg
```

On non-macOS systems, install a current FFmpeg build with `ffmpeg`, `ffprobe`, H.264, AAC, overlay, scale, and loudnorm support.

### Start a project

```sh
pnpm --filter @acme/social-media-agent video init \
  packages/social-media-agent/video-projects/2026-07-10-topic
```

Copy the recordings into `input/`, approved cutaways into `assets/`, and edit `project.json`:

```json
{
  "presenter": "input/presenter.mov",
  "captions": "input/captions.srt",
  "script": "script.md",
  "output": "output/final.mp4",
  "hook": "This bill changes who can get rental help",
  "cta": "Read the proposal, sources, and caveats",
  "ctaSubtext": "Open Billion",
  "cutaways": [
    {
      "source": "input/app-screen-recording.mov",
      "rights": "owned",
      "after": "here is what the bill changes",
      "duration": 4,
      "sourceStart": 2.5
    },
    {
      "source": "assets/eligibility-diagram.png",
      "rights": "owned",
      "after": "the income limit would rise",
      "duration": 3
    }
  ]
}
```

`after` is a phrase the presenter says. The editor finds that phrase in the timed captions and starts the visual there. This is much easier to maintain than frame numbers. `sourceStart` selects where to begin inside a screen recording. A cutaway may use a numeric `start` instead of `after`, but not both.

Every cutaway needs one rights value:

- `owned` — footage, screenshot, diagram, or photo created by the team;
- `official-public-domain` — official material that has been checked for public-domain status; add `sourceUrl`;
- `licensed` — material used under a license; add `sourceUrl`;
- `ai-generated` — an AI illustration; preserve the prompt/provider details separately and review disclosure needs.

Do not treat “found on Google” as a license.

### Captions

The most reliable option is a reviewed UTF-8 SRT file. Most transcription tools can export SRT. Captions should represent the actual performance, not merely the draft script.

For automatic transcription, remove `captions` from `project.json` and configure `GEMINI_API_KEY` in the normal repo environment. The pipeline extracts the presenter's audio, asks Gemini for timed phrases, writes the generated SRT beside the final video, and burns those captions into the Reel. Always proofread names, bill numbers, dates, and dollar amounts after rendering; AI timestamps and transcription can be wrong.

### Render

```sh
pnpm --filter @acme/social-media-agent video render \
  packages/social-media-agent/video-projects/2026-07-10-topic
```

The command automatically:

- frames portrait video at 1080×1920 and places non-portrait video over a blurred background;
- keeps the presenter's real audio as the master track;
- places app footage and approved visuals on their spoken phrase anchors;
- renders large two-line caption cards inside the vertical safe area;
- adds Billion's hook treatment, watermark, and closing CTA;
- normalizes speech to a social-friendly target;
- exports H.264/AAC MP4 at 30 fps with fast-start enabled;
- writes `output/captions.srt` and `output/qa.json`;
- fails if the output is not 1080×1920 H.264 with AAC audio.

The technical preset follows Meta's accepted publishing formats: vertical 9:16, H.264 video, AAC audio, and 30 fps. Organic Reels over three minutes are not recommended to new audiences, while boosted Reels must currently be under 90 seconds and full-screen 9:16. See [Instagram Reel sizing](https://www.facebook.com/help/1038071743007909), [Instagram Reel duration](https://www.facebook.com/help/instagram/225190788256708), [boosting requirements](https://www.facebook.com/help/instagram/570215404599013), and the [official Instagram API media specifications](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-1ff01566-3509-48bd-a0f4-8571a91ccfdf).

The pipeline is inspired by Carykh's transcript-driven automatic editor, but it does **not** copy random Google Image results. Carykh's prototype aligned topics and images to a transcript; Billion replaces unsourced image retrieval with app evidence, official material, owned graphics, licensed media, or reviewed AI illustrations. See [Carykh's automatic editor demonstration](https://www.youtube.com/watch?v=Jr9sptoLvJU) and the transcript-based [B-Script research](https://arxiv.org/abs/1902.11216).

## Visual selection and AI use

Use this priority order:

1. Billion screen recording that proves the claim;
2. official bill text, government data, map, chart, or source page;
3. the presenter;
4. team-owned documentary footage or photography;
5. licensed/public-domain media;
6. a simple original diagram;
7. a clearly illustrative AI-generated graphic.

Prefer diagrams for systems, timelines, comparisons, eligibility, and money flows. AI is useful for a geometric explainer, background texture, or obviously illustrative concept. It should not fabricate footage of a legislator, protest, disaster, affected person, government building event, or document. Never use an AI visual as evidence that something happened.

Meta requires disclosure for some photorealistic generated or materially altered video/audio and may apply an AI label. Review [Meta's AI labeling policy](https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/) before using realistic generated media.

## Mandatory review before posting

The editor produces a draft that is technically ready to upload. A teammate who did not make the first cut must still check all of the following:

- The hook is true and supported by the text.
- Bill number, jurisdiction, status, date, names, amounts, and captions are correct.
- “Would,” “may,” “passed,” “signed,” “effective,” and “blocked” are used accurately.
- The video includes the most important exception or uncertainty.
- Quoted text, neutral summary, and presenter interpretation are visually or verbally distinguishable.
- Each cutaway actually supports the words underneath it.
- Every visual has owned, public-domain, licensed, or documented AI provenance.
- No personal information, notifications, passwords, or teammate home address appears.
- The face, bill identifier, captions, and CTA remain clear in Instagram's safe-zone preview.
- Music is original or properly licensed, especially if the Reel may be boosted.
- Any required AI disclosure is present.
- The cover is selected carefully; Instagram's help center says it cannot currently be edited after upload.

Do not automate publication until this gate has a named reviewer. Civic content carries factual, legal, and reputational risk that an export check cannot catch.

## Posting and measurement

Write the caption as a short complement to the video, not a duplicate transcript. Include the bill number, status/as-of date, and one source path. Use a specific CTA and a clean cover with the consequence in 4–7 words.

At 24 hours, 72 hours, and 7 days, record:

- average watch time divided by video duration;
- shares divided by reach;
- saves divided by reach;
- follows divided by reach;
- non-follower reach;
- the hook, format, presenter, length, topic, and CTA used.

Instagram exposes views, watch time, average watch time, reach, follows, likes, comments, saves, and shares in [Reels Insights](https://www.facebook.com/help/instagram/202865988324236). Compare like with like: a 20-second surprising-clause video and a 45-second explainer should not be judged only by raw views.

Each week:

1. Keep the top two hooks by three-second retention and average watch percentage.
2. Keep topics with strong shares/saves even if raw views are smaller.
3. Retire a format only after several topics and at least two presenters have tested it.
4. Turn good comments into response videos.
5. Record the next week's tests before changing several variables at once.

If a post may be boosted, check its eligibility before production. Civic or bill explainers may be classified as political/social-issue advertising even when nonpartisan, which can trigger authorization and disclaimer requirements. Review [Meta's current US election and political-ad guidance](https://about.fb.com/news/2026/02/meta-prepares-for-2026-us-midterms/) before spending money on distribution.
