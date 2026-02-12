/**
 * ConsumerGoodsMarket — "State Department Store GUM"
 *
 * A consumer goods allocation panel where citizens can receive
 * food rations, vodka rations, clothing, and housing upgrades.
 * Each purchase deducts from global resources and boosts morale/loyalty.
 *
 * "The shelves are full of goods the workers need. Unfortunately,
 * the goods are in a different store, in a different city."
 */
import { ShoppingBag } from 'lucide-react';
import { useCallback, useState } from 'react';
import { citizens, dvory, getResourceEntity } from '@/ecs/archetypes';
import type { Resources } from '@/ecs/world';
import { cn } from '@/lib/utils';
import { notifyStateChange, useGameSnapshot } from '@/stores/gameStore';
import { addSovietToast } from '@/stores/toastStore';

interface GoodsItem {
  id: string;
  name: string;
  description: string;
  costType: 'money' | 'vodka';
  costAmount: number;
  /** Secondary cost (e.g. vodka rations also cost rubles) */
  secondaryCost?: { type: 'money'; amount: number };
  effect: 'morale' | 'loyalty';
  effectAmount: number;
  stockKey: keyof typeof STOCK_KEYS;
}

const STOCK_KEYS = {
  food: 'food',
  vodka: 'vodka',
  money: 'money',
} as const;

const GOODS_CATALOG: GoodsItem[] = [
  {
    id: 'bread_ration',
    name: 'Bread Ration Card',
    description: 'Daily 400g loaf. May contain sawdust for fiber.',
    costType: 'money',
    costAmount: 15,
    effect: 'morale',
    effectAmount: 3,
    stockKey: 'food',
  },
  {
    id: 'canned_fish',
    name: 'Canned Sprats',
    description: 'Baltic delicacy. Tin may predate the Revolution.',
    costType: 'money',
    costAmount: 25,
    effect: 'morale',
    effectAmount: 5,
    stockKey: 'food',
  },
  {
    id: 'vodka_ration',
    name: "People's Vodka Ration",
    description: 'Medicinal purposes only. Cures everything except socialism.',
    costType: 'vodka',
    costAmount: 10,
    secondaryCost: { type: 'money', amount: 5 },
    effect: 'morale',
    effectAmount: 8,
    stockKey: 'vodka',
  },
  {
    id: 'work_boots',
    name: 'Standard Work Boots',
    description: 'One size fits most. Left and right sold separately.',
    costType: 'money',
    costAmount: 40,
    effect: 'loyalty',
    effectAmount: 4,
    stockKey: 'money',
  },
  {
    id: 'winter_coat',
    name: 'Regulation Winter Coat',
    description: 'Warm enough for Siberia. Stylish enough for the gulag.',
    costType: 'money',
    costAmount: 60,
    effect: 'loyalty',
    effectAmount: 6,
    stockKey: 'money',
  },
];

const EMPTY_SHELF_QUIPS = [
  'Shelves inspected and found ideologically correct.',
  'The queue starts behind you, comrade.',
  'Come back next Five-Year Plan.',
  'Stock arriving any decade now.',
];

function getRandomQuip(): string {
  return EMPTY_SHELF_QUIPS[Math.floor(Math.random() * EMPTY_SHELF_QUIPS.length)]!;
}

/** Deduct resource costs for a goods purchase. */
function deductCosts(res: { resources: Resources }, item: GoodsItem): void {
  const r = res.resources;
  r[item.costType] -= item.costAmount;
  if (item.secondaryCost) r.money -= item.secondaryCost.amount;
  if (item.stockKey === 'food') r.food -= 10;
}

/** Apply morale or loyalty effect across all citizens/dvory. */
function applyEffect(item: GoodsItem): void {
  if (item.effect === 'morale') {
    for (const c of citizens.entities) {
      c.citizen.happiness = Math.min(100, c.citizen.happiness + item.effectAmount);
    }
  } else {
    for (const d of dvory.entities) {
      d.dvor.loyaltyToCollective = Math.min(100, d.dvor.loyaltyToCollective + item.effectAmount);
    }
  }
}

export function ConsumerGoodsMarket() {
  const snap = useGameSnapshot();
  const [lastPurchase, setLastPurchase] = useState<string | null>(null);

  const canAfford = useCallback(
    (item: GoodsItem): boolean => {
      // Check primary cost (money or vodka)
      if (item.costType === 'money' && snap.money < item.costAmount) return false;
      if (item.costType === 'vodka' && snap.vodka < item.costAmount) return false;
      // Check secondary cost (e.g. vodka rations also cost rubles)
      if (item.secondaryCost && snap.money < item.secondaryCost.amount) return false;
      // Check stock availability for distribution
      if (item.stockKey === 'food' && snap.food < 10) return false;
      return true;
    },
    [snap.money, snap.vodka, snap.food]
  );

  const handlePurchase = useCallback((item: GoodsItem) => {
    const res = getResourceEntity();
    if (!res) return;

    deductCosts(res, item);
    applyEffect(item);

    notifyStateChange();
    setLastPurchase(item.id);
    addSovietToast('warning', `Distributed: ${item.name}`);
    setTimeout(() => setLastPurchase(null), 1200);
  }, []);

  const hasAnything = snap.food > 10 || snap.vodka > 10 || snap.money > 15;

  return (
    <div className="space-y-2">
      {/* Store header */}
      <div className="bg-[#1a1a1a] border border-[#8b0000] px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <ShoppingBag className="w-4 h-4 text-[#cfaa48]" />
          <span className="text-[#cfaa48] text-xs font-bold uppercase tracking-widest">
            GUM Department Store
          </span>
        </div>
        <div className="text-[#666] text-[9px] italic">
          {hasAnything
            ? '"Everything for the Soviet citizen! (Subject to availability.)"'
            : `"${getRandomQuip()}"`}
        </div>
      </div>

      {/* Goods list */}
      <div className="space-y-1.5">
        {GOODS_CATALOG.map((item) => {
          const affordable = canAfford(item);
          const justBought = lastPurchase === item.id;
          return (
            <div
              key={item.id}
              className={cn(
                'bg-[#1a1a1a] border px-2.5 py-2 transition-colors',
                justBought
                  ? 'border-green-600'
                  : affordable
                    ? 'border-[#444]'
                    : 'border-[#333] opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[#ddd] text-[11px] font-bold">{item.name}</div>
                  <div className="text-[#666] text-[9px] italic leading-snug mt-0.5">
                    {item.description}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[#cfaa48] text-[9px] font-mono">
                      {item.costAmount} {item.costType === 'money' ? 'rub' : 'vodka'}
                      {item.secondaryCost ? ` + ${item.secondaryCost.amount} rub` : ''}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] font-mono',
                        item.effect === 'morale' ? 'text-green-500' : 'text-cyan-400'
                      )}
                    >
                      +{item.effectAmount} {item.effect}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => handlePurchase(item)}
                  className={cn(
                    'px-2 py-1 text-[9px] font-bold uppercase tracking-wider border',
                    'transition-colors flex-shrink-0 mt-0.5',
                    affordable
                      ? 'border-[#8b0000] bg-[#8b0000]/30 text-[#cfaa48] hover:bg-[#8b0000]/50 cursor-pointer'
                      : 'border-[#333] bg-[#222] text-[#555] cursor-not-allowed'
                  )}
                >
                  {justBought ? 'ISSUED' : 'ALLOCATE'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-[#555] text-[8px] text-center italic pt-1">
        All goods are property of the state. No returns, exchanges, or complaints.
      </div>
    </div>
  );
}
