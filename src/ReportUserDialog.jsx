import { useEffect, useRef, useState } from 'react';
import './social-safety.css';

const REASONS = [
  ['harassment', 'Harassment or threats'],
  ['impersonation', 'Impersonation'],
  ['cheating', 'Cheating or competition manipulation'],
  ['spam', 'Spam or scams'],
  ['inappropriate_content', 'Inappropriate username or content'],
  ['privacy_safety', 'Privacy or safety concern'],
  ['other', 'Something else'],
];

export default function ReportUserDialog({
  target,
  contextType = 'friends',
  contextId = null,
  busy = false,
  onClose,
  onSubmit,
}) {
  const dialogRef = useRef(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!target) {
      if (dialog?.open) dialog.close();
      return;
    }
    setReason('');
    setDetails('');
    setError('');
    if (dialog && !dialog.open) dialog.showModal();
  }, [target?.user_id, target?.id]);

  if (!target) return null;

  const id = target.user_id || target.id;
  const name = target.display_name || target.name || target.username || 'this user';
  const username = target.username || '';

  const submit = async event => {
    event.preventDefault();
    if (!reason || busy) return;
    setError('');
    try {
      await onSubmit(id, {
        reason,
        details,
        contextType,
        contextId,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Your report could not be sent.');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="qs-report-dialog"
      onCancel={event => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby="qs-report-title"
    >
      <form onSubmit={submit} aria-busy={busy}>
        <p className="qs-report-eyebrow">KEEP QUEST SAFE</p>
        <h2 id="qs-report-title">Report {name}</h2>
        {username && <p className="qs-report-user">@{username}</p>}
        <p>
          The person you report will not be told who submitted the report.
          Reports are stored privately for moderation.
        </p>

        <fieldset disabled={busy}>
          <legend>What happened?</legend>
          <div className="qs-report-reasons">
            {REASONS.map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="quest-report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={event => setReason(event.target.value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="qs-report-details">
          Add details <span>(optional)</span>
        </label>
        <textarea
          id="qs-report-details"
          value={details}
          onChange={event => setDetails(event.target.value.slice(0, 1000))}
          maxLength={1000}
          rows={5}
          disabled={busy}
          placeholder="Describe what happened. Avoid sharing unrelated sensitive information."
        />
        <small>{details.length}/1000</small>

        {error && <p className="qs-report-error" role="alert">{error}</p>}

        <div className="qs-report-actions">
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className="is-danger" disabled={busy || !reason}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
