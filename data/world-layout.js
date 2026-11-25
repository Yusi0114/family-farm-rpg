export const BED_SLOTS = [
  { x: 205, y: 230, wakeX: 275, wakeY: 230 },
  { x: 205, y: 340, wakeX: 275, wakeY: 340 },
  { x: 205, y: 450, wakeX: 275, wakeY: 450 },
  { x: 205, y: 555, wakeX: 275, wakeY: 555 },
  { x: 760, y: 325, wakeX: 690, wakeY: 325 },
  { x: 760, y: 435, wakeX: 690, wakeY: 435 },
  { x: 760, y: 545, wakeX: 690, wakeY: 545 }
];

export function getPlayerBedSlotIndex(players, playerId) {
  const index = [...players]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .findIndex(player => player.id === playerId);
  return index < 0 ? 0 : index % BED_SLOTS.length;
}

export function getPlayerBedSlot(players, playerId) {
  return BED_SLOTS[getPlayerBedSlotIndex(players, playerId)];
}
