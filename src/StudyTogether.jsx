import { useEffect, useState } from 'react';
import { StudyCharacter, StudyDialog, CharacterPicker } from './StudyCharacter.jsx';
import { loadFriendHub } from './friends.js';
import { otherFriendId } from './friends-core.js';
import { memberActivity, memberElapsed, sharedTaskLabel, studyTime, STUDY_CAPACITY } from './study-together.js';

// All seats share the existing room's coordinate plane. Back desks are smaller
// and painted first; front desks never cover another character's face.
const SEATS = [
  { x: 28, y: 37, scale: .88 }, { x: 51, y: 37, scale: .88 }, { x: 74, y: 37, scale: .88 },
  { x: 23, y: 58, scale: 1 }, { x: 49, y: 58, scale: 1 }, { x: 75, y: 58, scale: 1 },
];
export function CharacterAtDesk({ lookId, working, motion, seat, solo = false, name }) {
  const position = solo ? { x: 50, y: 38, scale: 1.4 } : SEATS[Math.max(0, Math.min(5, seat - 1))];
  return <div className={`st-seat${solo ? ' st-seat-solo' : ''}${working ? ' is-working' : ''}${motion ? ' has-motion' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${23 * position.scale}%`, zIndex: solo ? 2 : seat > 3 ? 4 : 2 }}>
    <div className="st-seated-person"><StudyCharacter lookId={lookId} studying={working}/></div>
    <img className="st-seat-desk" src="/study-room/desk-v2.webp" alt="" draggable="false"/>
    {working && <div className="st-seated-person st-person-hands"><StudyCharacter lookId={lookId} studying/></div>}
    {name && <span className="st-seat-name">{name}</span>}
  </div>;
}

export function SharedRoomArtwork({ controller, working, activity, motion, now }) {
  const members = controller.room?.members.filter(m => m.status === 'joined') || [];
  return <div className={`sr-art st-shared-art${motion ? ' has-motion' : ''}`} aria-hidden="true">
    <img className="sr-background" src="/study-room/room-v2.webp" alt="" fetchPriority="high" draggable="false"/>
    <span className="sr-lantern-light sr-lantern-window"/><span className="sr-lantern-light sr-lantern-shelf"/>
    <span className="sr-window-firefly sr-firefly-one"/><span className="sr-window-firefly sr-firefly-two"/>
    {members.length ? members.map(member => <CharacterAtDesk key={member.userId} seat={member.seat} lookId={member.userId === controller.userId ? controller.lookId : member.lookId}
      working={member.userId === controller.userId ? working : memberActivity(member, now) === 'studying'} motion={motion}
      name={`${member.name}${member.userId === controller.userId ? ' · you' : memberActivity(member, now) === 'away' ? ' · away' : memberActivity(member, now) === 'break' ? ' · break' : ''}`}/>)
      : <CharacterAtDesk solo lookId={controller.lookId} working={working && activity !== 'break'} motion={motion}/>}
  </div>;
}

export function StudyCompanions({ controller, now }) {
  if (!controller.room) return null;
  const members = controller.room.members.filter(m => m.status === 'joined');
  return <section className="st-companions" aria-label="People in your study room">
    <div className="st-companions-title"><span>OUR LITTLE STUDY CIRCLE</span><span>{members.length} / {STUDY_CAPACITY} here</span></div>
    <ul>{members.map(member => {
      const status = memberActivity(member, now), label = { studying: 'Studying', idle: 'Settling in', break: 'On a break', away: 'Away' }[status];
      return <li key={member.userId} data-activity={status}><span className="st-mini-avatar"><StudyCharacter lookId={member.lookId} studying={status === 'studying'}/></span><div><strong>{member.name}{member.userId === controller.userId ? ' (you)' : ''}</strong><span className="st-peer-task" title={sharedTaskLabel(member, now)}>{sharedTaskLabel(member, now)}</span><small><i aria-hidden="true"/>{label} <time>{studyTime(memberElapsed(member, now))}</time></small></div></li>;
    })}</ul>
  </section>;
}

function SessionDialog({ controller, taskName, onClose }) {
  const { room, userId, invites, busy, error } = controller;
  const [friends, setFriends] = useState([]), [friendError, setFriendError] = useState(''), [loadingFriends, setLoadingFriends] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const host = room?.hostId === userId, me = room?.members.find(m => m.userId === userId);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const now = clock + (controller.clockOffset || 0);
  useEffect(() => {
    if (!host) return;
    let alive = true; setLoadingFriends(true); setFriendError('');
    loadFriendHub(userId).then(hub => { if (alive) setFriends(hub.friends); }).catch(e => { if (alive) setFriendError(e.message); }).finally(() => { if (alive) setLoadingFriends(false); });
    return () => { alive = false; };
  }, [host, userId]);
  const run = async (action, args = {}) => { try { await controller.command(action, { roomId: room?.id, ...args }); setConfirm(false); } catch { /* Render the controller error. */ } };
  return <StudyDialog title={room ? 'A room for good company' : 'A little better, together'} eyebrow="STUDY TOGETHER" onClose={onClose}>
    <p className="st-description">A cozy room for you and up to five friends. Everyone follows their own task and timer.</p>
    {!!invites.length && <section className="st-invitations"><h3>Your invitations</h3>{invites.map(invite => <div className="st-invite" key={invite.id}><span className="st-mini-avatar"><StudyCharacter lookId={invite.lookId}/></span><div><strong>{invite.hostName}</strong><p>Saved you a seat.</p></div><div className="st-invite-actions"><button type="button" className="st-primary" disabled={busy || !!room} onClick={() => run('accept', { roomId: invite.id })}>Join</button><button type="button" disabled={busy} onClick={() => run('decline', { roomId: invite.id })}>Decline</button></div></div>)}{room && <p className="st-description">Leave this room before joining another.</p>}</section>}
    {!room ? <div className="st-create-room"><div className="st-room-illustration"><img src="/study-room/room-v2.webp" alt="A warmly lit pixel cottage waiting for your study circle"/><StudyCharacter lookId={controller.lookId}/></div><button type="button" className="st-primary" disabled={busy || controller.loading} onClick={() => run('create')}>{busy ? 'Preparing your room…' : 'Open a study room'}</button><p>Invite your Quest friends after opening. Task names start private.</p></div> : <>
      <div className="st-room-count"><strong>{room.members.length} / {STUDY_CAPACITY} seats reserved</strong><span>{host ? 'You’re the host' : 'You’re a guest'}</span></div>
      <ul className="st-member-list">{room.members.map(member => <li key={member.userId}><span className="st-mini-avatar"><StudyCharacter lookId={member.lookId}/></span><div><strong>{member.name}{member.userId === userId ? ' · you' : ''}</strong><small>{member.status === 'invited' ? 'Invitation sent' : member.userId === room.hostId ? 'Host' : 'In the room'}</small>{member.status === 'joined' && <><small className="st-session-task" title={sharedTaskLabel(member, now)}>{sharedTaskLabel(member, now)}</small><small>{memberActivity(member, now) === 'studying' ? 'Studying' : memberActivity(member, now) === 'break' ? 'On a break' : memberActivity(member, now) === 'away' ? 'Away' : 'Settling in'} · <time>{studyTime(memberElapsed(member, now))}</time></small></>}</div>{host && member.userId !== userId && <button type="button" disabled={busy} aria-label={`${member.status === 'invited' ? 'Cancel invitation for' : 'Remove'} ${member.name}`} onClick={() => run('remove', { targetId: member.userId })}>{member.status === 'invited' ? 'Cancel' : 'Remove'}</button>}</li>)}</ul>
      <label className="st-privacy"><input type="checkbox" checked={!!me?.shareTask} disabled={busy} onChange={event => run('privacy', { data: { shareTask: event.target.checked, ...(event.target.checked ? { taskName: taskName || '' } : {}) } })}/><span><strong>Share my task name</strong><small>{me?.shareTask ? 'People in this room can see what you’re working on.' : 'Friends see your character, study status and timer only.'}</small></span></label>
      {host && <section className="st-friend-picker"><h3>Save a seat for a friend</h3>{loadingFriends && <p>Finding your friends…</p>}{friendError && <p className="st-error">{friendError}</p>}{!loadingFriends && !friendError && !friends.length && <p><a href="#friends" onClick={onClose}>Add a friend in You → Friends</a>, then come back to invite them.</p>}
        {friends.map(friend => { const friendId = otherFriendId(friend, userId), taken = room.members.some(m => m.userId === friendId), name = friend.profile?.display_name || friend.profile?.username || 'Friend'; return <div key={friendId}><span>{name}</span><button type="button" disabled={busy || taken || room.members.length >= STUDY_CAPACITY} onClick={() => run('invite', { targetId: friendId })}>{taken ? 'Seat reserved' : 'Invite'}</button></div>; })}
        {room.members.length >= STUDY_CAPACITY && <p>Your circle is full. Cancel an invitation to free a seat.</p>}
      </section>}
      <div className="st-leave-room"><button type="button" disabled={busy} onClick={() => run('leave')}>Leave room</button><button type="button" disabled={busy} onClick={() => run('new_room')}>Start a new room</button><small>Your task timer continues. If you host, a remaining friend takes over; your pending invitations close.</small>{host && (confirm ? <><p>End this room for everyone?</p><button type="button" disabled={busy} onClick={() => run('end')}>Yes, end the room</button><button type="button" onClick={() => setConfirm(false)}>Keep it open</button></> : <button type="button" disabled={busy} onClick={() => setConfirm(true)}>End session for everyone</button>)}</div>
    </>}
    {error && <div role="alert" className="st-error">{error}<button type="button" onClick={() => controller.refresh()}>Try again</button></div>}
  </StudyDialog>;
}

export function StudySocialBar({ controller, taskName }) {
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const roomAction = async action => {
    try {
      await controller.command(action, { roomId: controller.room?.id });
      setNotice(action === 'leave' ? 'You left the room. Your timer keeps going.' : 'Your new room is ready. Invite friends whenever you like.');
      if (action !== 'leave') setDialog('session');
    } catch { /* The shared controller displays the error. */ }
  };
  const count = controller.room?.members.filter(m => m.status === 'joined').length || 0;
  return <>
    <div className="st-room-toolbar">
    <div className="st-social-bar"><button type="button" className="st-character-button" aria-label="Your character" onClick={() => setDialog('character')}><span className="st-mini-avatar"><StudyCharacter lookId={controller.lookId}/></span><span>Your character</span></button><button type="button" className="st-together-button" onClick={() => setDialog('session')}><span aria-hidden="true">✦</span> {controller.room ? `Your room · ${count}/6` : 'Study together'}{!!controller.invites?.length && <b aria-label={`${controller.invites.length} study invitations`}>{controller.invites.length}</b>}</button></div>
    <div className="st-quick-room-actions" aria-label="Room controls">
      {controller.room && <button type="button" disabled={controller.busy} onClick={() => roomAction('leave')}>‹ Leave room</button>}
      <button type="button" disabled={controller.busy || controller.loading} onClick={() => roomAction(controller.room ? 'new_room' : 'create')}>+ New room</button>
      {notice && <span role="status">{notice}</span>}
    </div>
    </div>
    {controller.error && !dialog && <p className="st-connection-note" role="status">Room connection needs attention. Your own timer still works. <button type="button" onClick={() => controller.refresh()}>Reconnect</button></p>}
    {dialog === 'character' && <CharacterPicker controller={controller} onClose={() => setDialog(null)}/>}
    {dialog === 'session' && <SessionDialog controller={controller} taskName={taskName} onClose={() => setDialog(null)}/>}
  </>;
}
