import { ITEMS, STARTER_WOOD_TOOLS } from '../data/items-recipes.js';

function getInventoryEntries(inventory) {
  if (Array.isArray(inventory)) {
    return inventory.map(item => [item.itemId || item.id, item.count || 0]);
  }
  return Object.entries(inventory || {});
}

function getItemCount(inventory, itemId) {
  if (Array.isArray(inventory)) {
    return inventory.find(item => (item.itemId || item.id) === itemId)?.count || 0;
  }
  return Number(inventory?.[itemId] || 0);
}

export function buildStarterToolsState(player = {}) {
  const inventory = Array.isArray(player.inventory)
    ? [...player.inventory]
    : { ...(player.inventory || {}) };
  const tools = { ...(player.tools || {}) };
  let changed = false;

  for (const toolId of STARTER_WOOD_TOOLS) {
    if (getItemCount(inventory, toolId) > 0) continue;

    if (Array.isArray(inventory)) inventory.push({ itemId: toolId, count: 1 });
    else inventory[toolId] = 1;
    changed = true;
  }

  for (const toolId of STARTER_WOOD_TOOLS) {
    const category = ITEMS[toolId].toolCategory;
    const equippedId = tools[category];
    const equippedItem = ITEMS[equippedId];
    if (equippedItem?.toolCategory === category && getItemCount(inventory, equippedId) > 0) continue;

    const bestOwnedTool = getInventoryEntries(inventory)
      .filter(([id, count]) => Number(count) > 0 && ITEMS[id]?.toolCategory === category)
      .sort((a, b) => (ITEMS[b[0]].bonus || 0) - (ITEMS[a[0]].bonus || 0))[0]?.[0];
    const selectedTool = bestOwnedTool || toolId;
    if (tools[category] !== selectedTool) {
      tools[category] = selectedTool;
      changed = true;
    }
  }

  return { changed, inventory, tools };
}

export function getRequiredToolBonus(player, toolCategory) {
  const categoryNames = {
    hoe: '開墾鋤',
    watering_can: '澆水器',
    pickaxe: '十字鎬',
    axe: '伐木斧',
    fishing_rod: '釣魚竿',
    trowel: '趕海鏟'
  };
  let bestBonus = -1;

  for (const [itemId, count] of getInventoryEntries(player?.inventory)) {
    const item = ITEMS[itemId];
    if (Number(count) > 0 && item?.toolCategory === toolCategory) {
      bestBonus = Math.max(bestBonus, Number(item.bonus) || 0);
    }
  }

  const equippedId = player?.tools?.[toolCategory];
  const equippedItem = ITEMS[equippedId];
  if (equippedItem?.toolCategory === toolCategory) {
    bestBonus = Math.max(bestBonus, Number(equippedItem.bonus) || 0);
  }

  if (bestBonus < 0) {
    throw new Error(`身上沒有「${categoryNames[toolCategory] || '對應工具'}」，無法執行此動作！`);
  }

  return bestBonus;
}
