import {
  Action,
  ActionPanel,
  Form,
  PopToRootType,
  Toast,
  getPreferenceValues,
  showHUD,
  showToast,
} from "@raycast/api";
import { useRef, useState } from "react";
import { WikiError, createQuickNote, normaliseBase } from "./wiki";

interface Preferences {
  spaceUrl: string;
  token: string;
}

export default function SendToDuet() {
  const preferences = getPreferenceValues<Preferences>();
  const base = normaliseBase(preferences.spaceUrl);
  // A pasted key often carries a stray space or line break.
  const token = preferences.token.trim();

  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Read synchronously, so two quick ⌘Enters can't both get through.
  const sending = useRef(false);

  async function send() {
    // A second ⌘Enter while the first is on its way would save the note twice.
    if (sending.current) return;
    if (!note.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Nothing to send",
        message: "Type a note first.",
      });
      return;
    }
    sending.current = true;
    setIsSending(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Sending to Duet…",
    });
    try {
      await createQuickNote(base, token, note);
      await toast.hide();
      await showHUD("Sent to Duet", {
        popToRootType: PopToRootType.Immediate,
      });
    } catch (err) {
      // The note stays in the form, so nothing typed is lost.
      toast.style = Toast.Style.Failure;
      toast.title = "Couldn't send to Duet";
      toast.message =
        err instanceof WikiError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  }

  return (
    <Form
      isLoading={isSending}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Send to Duet" onSubmit={send} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="note"
        title="Note"
        placeholder="Type a quick note…"
        value={note}
        onChange={setNote}
        autoFocus
      />
    </Form>
  );
}
