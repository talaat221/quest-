export const FARM_CHEST_XP = 100;
export const FARM_SPECIES = [
  { id:'carrot', name:'Carrot', rarity:'common', group:'Vegetable', sprite:0 },
  { id:'strawberry', name:'Strawberry', rarity:'common', group:'Fruit', sprite:1 },
  { id:'pumpkin', name:'Pumpkin', rarity:'common', group:'Vegetable', sprite:2 },
  { id:'blueberry', name:'Blueberry', rarity:'uncommon', group:'Fruit', sprite:3 },
  { id:'sunflower', name:'Sunflower', rarity:'uncommon', group:'Flower', sprite:4 },
  { id:'lavender', name:'Lavender', rarity:'uncommon', group:'Flower', sprite:5 },
  { id:'moon-lily', name:'Moon Lily', rarity:'rare', group:'Flower', sprite:6, title:'Moon Lily Keeper' },
  { id:'golden-apple', name:'Golden Apple', rarity:'legendary', group:'Fruit', sprite:7, title:'Golden Orchard Keeper' },
  { id:'crystal-lotus', name:'Crystal Lotus', rarity:'rare', group:'Flower', sprite:8, title:'Crystal Garden Keeper' },
  { id:'tomato', name:'Tomato', rarity:'common', group:'Vegetable', sprite:9 },
  { id:'peach', name:'Peach', rarity:'uncommon', group:'Fruit', sprite:10 },
  { id:'starflower', name:'Starflower', rarity:'legendary', group:'Flower', sprite:11, title:'Starlight Garden Keeper' },
];
export const farmSpecies = id => FARM_SPECIES.find(s=>s.id===id) || FARM_SPECIES[0];
export function farmTitle(farm) {
  return [...FARM_SPECIES].sort((a,b)=>(b.rarity==='legendary'?2:1)-(a.rarity==='legendary'?2:1))
    .find(s=>s.title&&Number(farm?.discovered?.[s.id])>0) || null;
}
export function farmGrowth(farm,plant) {
  const xp=Math.max(0,(Number(farm?.growthXP)||0)-(Number(plant?.plantedXP)||0));
  return { xp, stage:xp>=70?'Blooming':xp>=30?'Growing':'Seedling', sprite:xp<30?13:farmSpecies(plant.species).sprite, scale:xp<30?.65:xp<70?.78:1 };
}
export function farmChestProgress(farm) {
  const earned=Math.max(0,Number(farm?.earnedXP)||0), next=(Number(farm?.openedChests)||0)+1;
  return { next, ready:Math.max(0,Math.floor(earned/FARM_CHEST_XP)-next+1),
    remaining:Math.max(0,next*FARM_CHEST_XP-earned), percent:Math.max(0,Math.min(100,earned-(next-1)*FARM_CHEST_XP)) };
}
export function farmCareCopy(farm) {
  if(farm?.care?.protected)return 'Rest day · farm protected';
  if(farm?.care?.cared)return 'Watered for today';
  if(farm?.care?.welcome)return 'Welcome day · farm protected';
  return `${Math.min(1,farm?.care?.tasks||0)}/1 task or ${Math.min(3,farm?.care?.anchors||0)}/3 anchors`;
}
