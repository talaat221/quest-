import { useEffect, useId, useRef, useState } from 'react';
import { FARM_SPECIES, farmSpecies, farmGrowth, farmChestProgress, farmTitle, farmCareCopy } from './farm.js';
import { farmCommand, loadFarmSummaries } from './farm-api.js';
import './farm.css';

export function FarmSprite({index,className='',...props}) {
  return <span {...props} aria-hidden="true" className={`fg-sprite ${className}`} style={{'--sprite-x':`${index%4/3*100}%`,'--sprite-y':`${Math.floor(index/4)/3*100}%`,...props.style}}/>;
}
export function FarmScene({farm,field=0,compact=false,onSelect}) {
  const plants=(farm?.plants||[]).slice(field*10,field*10+10);
  const Plot=onSelect?'button':'span';
  return <div className={`fg-scene${compact?' is-mini':''}`} aria-label={`${farm?.name||'Farm'}: ${farm?.plants?.length||0} living plants`}>
    <img className="fg-landscape" src="/farm-v1/night-garden.webp" alt="A lantern-lit garden beside a lake"/>
    <div className="fg-plots">{Array.from({length:10},(_,i)=>{
      const plant=plants[i],s=plant&&farmSpecies(plant.species),growth=plant&&farmGrowth(farm,plant);
      return <Plot key={plant?.id||`empty-${i}`} type={onSelect?'button':undefined} className={`fg-plot${plant?' is-planted':''}`}
        disabled={onSelect?!plant:undefined} aria-label={plant?`${s.name}, ${growth.stage}`:'Empty plot — earn a seed chest'}
        onClick={()=>onSelect?.(plant)} style={{left:`${10+(i%5)*20}%`,top:`${Math.floor(i/5)*48}%`}}>
        <FarmSprite index={12} className="fg-soil"/>{plant&&<FarmSprite index={growth.sprite} className={`fg-plant is-${s.rarity}`} style={{'--plant-scale':growth.scale}}/>}
      </Plot>;
    })}</div>
    {!compact&&<span className="fg-scene-label">FIELD {field+1} · {plants.length}/10 GROWING</span>}
  </div>;
}
export function FarmMini({controller}) {
  const farm=controller?.farm,progress=farmChestProgress(farm);
  return <a href="#farm" className="fg-mini-card" aria-label="Open your farm">
    <div className="fg-mini-title"><FarmSprite index={13}/><strong>My farm</strong><span>›</span></div>
    <FarmScene farm={farm} compact/>
    <strong className="fg-mini-name">{farm?.name||'Your little farm'}</strong>
    <span>{farm?`LV ${farm.level} · ${farm.plants.length} plants`:controller?.error?'Tap to reconnect':'Planting your first seed…'}</span>
    <small>{farm?(progress.ready?`${progress.ready} seed chest${progress.ready===1?'':'s'} ready!`:farmCareCopy(farm)):'A small start. A living reward.'}</small>
  </a>;
}
function FarmModal({title,children,onClose}) {
  const ref=useRef(null),id=useId();
  useEffect(()=>{const opener=document.activeElement,dialog=ref.current;dialog.showModal();return()=>{dialog.close();if(opener?.isConnected)opener.focus();};},[]);
  return <dialog ref={ref} className="fg-dialog fg-panel" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}>
    <button className="fg-close" aria-label="Close farm dialog" onClick={onClose}>×</button><h2 id={id}>{title}</h2>{children}
  </dialog>;
}
export function FarmBadge({farm}) {
  const title=farmTitle(farm);
  return title?<span className={`fg-badge is-${title.rarity}`}><FarmSprite index={title.sprite}/>{title.title}</span>:null;
}
export default function FarmPage({controller,visitingId,onBack}) {
  const [guest,setGuest]=useState(null),[guestError,setGuestError]=useState(''),[field,setField]=useState(0),[selected,setSelected]=useState(null);
  const [editing,setEditing]=useState(false),[name,setName]=useState(''),[chest,setChest]=useState(null);
  const farm=visitingId?guest:controller.farm,progress=farmChestProgress(farm),badge=farmTitle(farm);
  useEffect(()=>{if(!visitingId)return;let live=true;setGuest(null);setGuestError('');
    farmCommand('read',{p_target:visitingId}).then(data=>{if(live){setGuest(data);if(!data)setGuestError('This traveler has not started their farm yet.');}}).catch(e=>live&&setGuestError(e.message));
    return()=>{live=false;};},[visitingId]);
  const pageField=Math.min(field,Math.max(0,(farm?.level||1)-1));
  const error=visitingId?guestError:controller.error;
  return <div className="fg-page">
    <div className="fg-topline"><button className="fg-back" onClick={onBack||(()=>{window.location.hash='home';})}>‹ {visitingId?'Back to competition':'Home'}</button><span>THE LIVING GARDEN</span></div>
    <header className="fg-header"><p>{visitingId?`${farm?.ownerName||'Your friend'}’s corner of Quest`:'Every small effort takes root.'}</p><h1>{farm?.name||'Your little farm'}</h1>
      {badge&&<FarmBadge farm={farm}/>}<div className="fg-header-actions"><span>FARM LEVEL {farm?.level||1}</span>{!visitingId&&<button onClick={()=>{setName(farm?.name||'My little farm');setEditing(true);}} disabled={!farm}>Rename farm</button>}</div>
    </header>
    {error&&<div className="fg-error" role="alert">{error}{!visitingId&&<button onClick={controller.refresh}>Try again</button>}</div>}
    <div className="fg-garden-frame"><FarmScene farm={farm} field={pageField} onSelect={setSelected}/></div>
    {farm?.level>1&&<div className="fg-fields" aria-label="Choose a field">{Array.from({length:farm.level},(_,i)=><button key={i} aria-pressed={pageField===i} onClick={()=>setField(i)}>Field {i+1}</button>)}</div>}
    <div className="fg-milestones"><div><strong>{farm?.plants?.length||0}<small>/{(farm?.level||1)*10}</small></strong><span>plants to next field</span></div><div><strong>{Object.keys(farm?.discovered||{}).length}<small>/{FARM_SPECIES.length}</small></strong><span>species discovered</span></div><div><FarmSprite index={13}/><span>{visitingId?'A garden grown through effort':'Earn XP. Watch life grow.'}</span></div></div>
    {!visitingId&&<div className="fg-action-grid">
      <section className="fg-panel fg-chest"><FarmSprite index={progress.ready?15:14}/><div><span className="fg-eyebrow">SEED TREASURES</span><h2>{progress.ready?'A new life is waiting':'Your next seed chest'}</h2><p>{progress.ready?`${progress.ready} chest${progress.ready===1?'':'s'} ready to open`:`${progress.remaining} XP to go`}</p>
        <progress value={progress.percent} max="100" aria-label="XP toward next seed chest"/><small>One chest every 100 XP earned after starting your farm.</small>
        <button className="fg-button" disabled={!farm||!progress.ready||controller.busy} onClick={async()=>{try{const next=await controller.openChest();setChest(next.lastChest);}catch{/* Error shown above. */}}}>{controller.busy?'Opening…':progress.ready?'Open seed chest':'Keep growing'}</button></div></section>
      <section className="fg-panel fg-care"><span className="fg-eyebrow">A LITTLE CARE, EVERY DAY</span><h2>{farmCareCopy(farm)}</h2><p>Complete <strong>1 quest task</strong> or <strong>3 daily anchors</strong> to water every plant.</p>
        <div className="fg-care-count"><span className={farm?.care?.tasks?'is-done':''}>{Math.min(1,farm?.care?.tasks||0)}/1 task</span><b>or</b><span className={farm?.care?.anchors>=3?'is-done':''}>{Math.min(3,farm?.care?.anchors||0)}/3 anchors</span></div>
        <p className="fg-muted">An uncared-for day costs one random plant after your day resets. Welcome day and Stop Day are protected. Your discoveries and unlocked fields stay.</p><a href="#quests">Do something small today ›</a>
      </section>
    </div>}
    <section className="fg-panel fg-collection"><div className="fg-section-heading"><div><span className="fg-eyebrow">THE SEED ALMANAC</span><h2>{visitingId?'Their discoveries':'Your growing collection'}</h2></div><span>{Object.keys(farm?.discovered||{}).length}/{FARM_SPECIES.length}</span></div>
      <div className="fg-species-grid">{FARM_SPECIES.map(s=>{const count=farm?.discovered?.[s.id]||0;return <div key={s.id} className={`fg-species is-${s.rarity}${count?'':' is-locked'}`}><FarmSprite index={s.sprite}/><strong>{s.name}</strong><span>{s.rarity}</span><small>{count?`Discovered ×${count}`:'Find in a chest'}</small></div>;})}</div>
    </section>
    {!visitingId&&<details className="fg-panel fg-rules"><summary>How your farm grows</summary><p>You begin with one carrot seedling. New XP feeds every plant: 30 XP makes a seedling grow, and 70 XP makes it bloom. Opening a chest plants a new collectible automatically.</p><p>Fill ten plots to unlock another field. Duplicate plants are welcome. Empty spaces left by lost plants are filled by later chests.</p><p>Regular chest odds: 60% common, 28% uncommon, 10% rare, 2% legendary. Every fifth chest guarantees rare or better; every tenth guarantees legendary. Collecting a rare plant gives you a title below your name in Competition.</p><p>No purchases or payments. Your home XP is not spent. Undoing a task cannot generate another chest by completing it again. New farming progress begins here, so earlier XP does not fill the garden instantly.</p><p>Daily care uses your saved farm timezone ({farm?.timezone||'your local timezone'}) and Quest’s reset hour. Completed days are checked when the farm syncs or is visited. Today stays open until reset.</p></details>}
    {!visitingId&&farm?.careLog?.length>0&&<section className="fg-panel fg-history"><h2>Garden journal</h2>{[...farm.careLog].reverse().slice(0,5).map((event,i)=><p key={`${event.day}-${i}`}><time>{event.day}</time> · {farmSpecies(event.species).name} was lost after a missed care day.</p>)}</section>}
    {editing&&<FarmModal title="Name your little world" onClose={()=>setEditing(false)}><form onSubmit={async e=>{e.preventDefault();try{await controller.rename(name);setEditing(false);}catch{/* Keep form open. */}}}><label>Farm name<input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={40} required/></label>{controller.error&&<p role="alert">{controller.error}</p>}<button className="fg-button" disabled={controller.busy||!name.trim()}>Save farm name</button></form></FarmModal>}
    {chest&&<FarmModal title={`${farmSpecies(chest.species).name} found!`} onClose={()=>setChest(null)}><div className="fg-reveal"><FarmSprite index={farmSpecies(chest.species).sprite}/><span className={`fg-rarity is-${chest.rarity}`}>{chest.rarity}</span><p>Your new plant is already growing in your farm.</p>{farmSpecies(chest.species).title&&<strong>Title unlocked: {farmSpecies(chest.species).title}</strong>}<button className="fg-button" onClick={()=>setChest(null)}>Meet my new plant</button></div></FarmModal>}
    {selected&&<FarmModal title={farmSpecies(selected.species).name} onClose={()=>setSelected(null)}><div className="fg-reveal"><FarmSprite index={farmSpecies(selected.species).sprite}/><p>{farmSpecies(selected.species).rarity} · {farmGrowth(farm,selected).stage}</p><p>{farmGrowth(farm,selected).xp>=70?'Blooming in your garden.':`${70-farmGrowth(farm,selected).xp} more farm XP until blooming.`}</p><button className="fg-button" onClick={()=>setSelected(null)}>Back to the garden</button></div></FarmModal>}
  </div>;
}

export function useFriendFarms(ids) {
  const key=[...new Set(ids.filter(Boolean))].sort().join(',');
  const [farms,setFarms]=useState({}),[error,setError]=useState('');
  useEffect(()=>{let live=true;setFarms({});
    const load=()=>loadFarmSummaries(key?key.split(','):[]).then(rows=>{if(live){setFarms(Object.fromEntries(rows.map(f=>[f.userId,f])));setError('');}}).catch(e=>live&&setError(e.message));
    load();const timer=setInterval(load,60000);return()=>{live=false;clearInterval(timer);};
  },[key]);return {farms,error};
}
