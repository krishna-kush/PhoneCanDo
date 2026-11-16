# Local model cases

Models served on the phone by llama.cpp's server, and their Memory page.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

The problem behind [MODEL-02](#model-02): when two chats take turns on one
local model (an agent and its sub-agent, or two agents), each turn read its
whole prompt again, taking minutes.

To read the model's log during a test:
`adb shell run-as com.phonecando.app.full.dev tail -c 2000 files/logs/model-server-qwen3-5-0-8b-q4-k-m.log`.
Note each "prompt eval time … / N tokens" line with its time, and lines with
"selected slot", "cache", "checkpoint", "exceeds", "removing" or "forcing".

## Cases

<a id="model-01"></a>

### MODEL-01 One chat alone reuses its prompt

- **Agents:** A-04 (local 0.8B).
- **Setup:** none.
- **Steps:** Give A-04 a task that takes many turns. Read the model's log.
- **Expect:** The first request reads the whole prompt. Later requests read
  only the new part, with `selected slot by LCP similarity … f_keep = 1.000`.
- **Touches:** llama.cpp's server (`lme/llamacpp/`); runner `models/`.

<a id="model-02"></a>

### MODEL-02 Two chats take turns: turn C reuses its saved state

- **Agents:** A-04 and A-10, both on the 0.8B.
- **Setup:** Only these two use the 0.8B. Stop other agents if RAM is short.
- **Steps:**
  1. Turn A: in A-04, /clear, then send: Say hello in one short line.
  2. Turn B: in A-10, start a new chat (/new) and send: Say hello in one
     short line.
  3. Turn C: back in A-04, same chat, send: Now say goodbye in one short
     line.
  4. Read the model's log every 3 to 5 minutes, and save it at the end.
- **Expect:** Turn C reads only what was added since turn A, because
  A-04's chat comes back from storage ([MODEL-13](#model-13); on a phone
  short of storage, from the saved chats in RAM). No "exceeds cache size
  limit" line.
- **Touches:** `phonecando-models` (`context/ModelContexts.kt`,
  `ram/RamChecks.kt`, `serving/`); lme's plan; the runner's
  `models/chats/`.

<a id="model-03"></a>

### MODEL-03 Memory page: live line and Advanced

- **Agents:** none (the 0.8B's page).
- **Setup:** none.
- **Steps:** Open the 0.8B's model page, then Memory. Tap Less and More.
  Open Advanced. Change nothing and leave without saving.
- **Expect:** The live line ("On this phone: context … · chats on storage
  · … GB", or "… chats saved …" when chats stay in RAM) follows the choice
  and agrees with Advanced (Context, Note size,
  Saved chats, Snapshots, CPU threads, each with its Auto value). A line
  under it says what limits it now.
- **Touches:** app `ui/models/memory/`; `phonecando-models`
  (`context/ModelContexts.kt`, `api/RecordMaps.kt`).

<a id="model-04"></a>

### MODEL-04 Memory page for the 4B

- **Agents:** none (the 4B's page).
- **Setup:** none.
- **Steps:** Open the 4B's Memory. Change nothing.
- **Expect:** The live line shows half-size notes and chats on storage.
  Since 2026-11-16 the 4B's memory is measured, so on an 8 GB phone it may
  read less than 32k and "Too big for this phone" (see
  [MODEL-15](#model-15)).
- **Touches:** as in [MODEL-03](#model-03).

<a id="model-05"></a>

### MODEL-05 Detailed log switch is there, off, with its note

- **Agents:** none (the 0.8B's page).
- **Setup:** none.
- **Steps:** Open the 0.8B's Server log page.
- **Expect:** A "Detailed log" switch, off, with a note that changing it
  restarts the model. Leave it off.
- **Touches:** app `ui/models/`; `phonecando-models` (`serving/`).

<a id="model-06"></a>

### MODEL-06 New model list format: old list read as damaged; delete and download again

- **Agents:** A-04 (to check it still points to the 0.8B).
- **Setup:** A build that changed the model list's format.
- **Steps:**
  1. Open Models. Note what it shows.
  2. Delete only the list:
     `adb shell run-as com.phonecando.app.full.dev rm files/models/models.json`.
  3. Force stop the app and open it again. Models should be empty.
  4. Download Qwen3.5 0.8B and 4B (Q4_K_M) again.
  5. Check A-04's page still shows the 0.8B as its model.
- **Expect:** The old list reads as damaged. After the delete, the
  downloads finish (in seconds when the files are still there), and A-04
  still points to the 0.8B.
- **Touches:** `phonecando-models` (the model list), app `ui/models/`.
- **Note:** The delete needs my yes: ask before it.

<a id="model-07"></a>

### MODEL-07 Saving a Memory page change, then setting it back

- **Agents:** none run on the model.
- **Setup:** No agent working on the 0.8B.
- **Steps:** On the 0.8B's Memory, Advanced, set Saved chats to 1, then
  Save. Then set it back to Auto and Save.
- **Expect:** The button reads "MEMORY: NORMAL · 1 SET", then "MEMORY:
  NORMAL". No errors.
- **Touches:** app `ui/models/memory/`; `phonecando-models`
  (`api/ModelFunctions.kt`).

<a id="model-08"></a>

### MODEL-08 One agent's own turn switching between two prompts

- **Agents:** A-04 (local 0.8B).
- **Setup:** none.
- **Steps:** Give A-04 a task where Claude Code makes a side request (a
  different prompt) in the middle of its turn. Read the model's log.
- **Expect:** Switching back to the main chat does not read it again.
- **Touches:** `phonecando-models` (saved chats); the runner's
  `models/chats/`; llama.cpp's server.
- **Note:** With chats in RAM and room for one saved chat this is a known
  limit: the server saves the outgoing chat before it loads the incoming
  one. Since 2026-11-16 chats go to storage when there is room (up to 4),
  which this case has not run with yet.

<a id="model-09"></a>

### MODEL-09 Saving a Memory page change while an agent runs on the model

- **Agents:** A-04 on the 0.8B.
- **Setup:** A-04 running on the model.
- **Steps:** Change Saved chats on the Memory page and Save.
- **Expect:** A note says the model restarts, and it does.
- **Touches:** app `ui/models/memory/`; runner `models/`.

<a id="model-10"></a>

### MODEL-10 The detailed log switch turned on

- **Agents:** A-04 on the 0.8B.
- **Setup:** none.
- **Steps:** Turn on Detailed log, then run a short turn.
- **Expect:** The model restarts, and its log shows what it reuses, what it
  reads again, and where a prompt first changes.
- **Touches:** `phonecando-models` (`serving/`).
- **Note:** Low priority: unit tests cover it. The log then holds prompt
  text: don't copy it into evidence.

<a id="model-11"></a>

### MODEL-11 Sliding-window models

- **Agents:** an agent on a sliding-window model.
- **Setup:** Needs such a model on the phone; ours has none.
- **Steps:** As in [MODEL-02](#model-02).
- **Expect:** As in [MODEL-02](#model-02).
- **Touches:** `phonecando-models` (`context/ModelContexts.kt`).
- **Note:** Low priority: unit tests cover it.

<a id="model-12"></a>

### MODEL-12 The 4B actually serving with half-size notes

- **Agents:** an agent on the 4B.
- **Setup:** none.
- **Steps:** Give the agent a short task on the 4B. Read its log.
- **Expect:** It serves with half-size notes, as its Memory page says.
- **Touches:** `phonecando-models` (`serving/ServingModel.kt`).
- **Note:** Low priority: unit tests cover it.

<a id="model-13"></a>

### MODEL-13 Chats that take turns come back from storage

- **Agents:** A-04 and A-10, both on the 0.8B.
- **Setup:** Only these two use the 0.8B. Stop other agents if RAM is
  short.
- **Steps:** Run [MODEL-02](#model-02)'s three turns. While turn B starts
  and while turn C starts, read logcat (`adb logcat -d -s
  PhoneCanDoModels`) and the model's log.
- **Expect:** When turn B takes over, logcat says A-04's chat was kept on
  storage. When turn C starts, it says the chat was loaded back from
  storage, and the model's log says "restored … context checkpoint(s)".
  Turn C reads only what was added since turn A (the new message and what
  the agent adds to each request; about 1.4k tokens for Claude Code on
  2026-11-16), not the whole chat. The load itself takes a second or two.
  (Until 2026-11-16 this said "a few dozen tokens", which was too strict.)
- **Touches:** the runner's `models/chats/` (the go-between), lme's
  `chats/`.

<a id="model-14"></a>

### MODEL-14 Saved chat files are private to the app

- **Agents:** none (after [MODEL-13](#model-13)).
- **Setup:** MODEL-13 ran.
- **Steps:** List the model's saved chats: `adb shell run-as
  com.phonecando.app.full.dev ls -l files/models/<id>/.chats/`.
- **Expect:** One or more `.bin` files, each `-rw-------`; no `.tmp` file
  left.
- **Touches:** the runner's `models/chats/ChatFiles.kt`.

<a id="model-15"></a>

### MODEL-15 Each model's memory is measured, and the Memory page says so

- **Agents:** none.
- **Setup:** The app started once since the build was installed.
- **Steps:** Read logcat for the measuring lines (`adb logcat -d -s
  PhoneCanDoModels | grep -i measured`). Open each model's Memory setting
  and read its lines.
- **Expect:** A "measured at …" line for each downloaded model, with the
  copied (repacked) size. The 0.8B's Memory line shows no "about", and says
  chats that take turns are kept on storage. Note the 4B's measured total
  as it is: what to do about it is an open question, not part of this
  case.
- **Touches:** the runner's `models/measure/`, lme's `ram/ServerMemory.kt`,
  `phonecando-models` (`memory/ModelMemory.kt`).
