import type { Board, Card, ColorGroup, Space } from '../types';

// A classic-style default board. Names are generic: rename them in Admin to
// match whatever is printed on your physical board.

const groups: ColorGroup[] = [
  { id: 'brown', name: 'Brown', color: '#8B5E3C' },
  { id: 'lightblue', name: 'Light blue', color: '#7DD3FC' },
  { id: 'pink', name: 'Pink', color: '#EC4899' },
  { id: 'orange', name: 'Orange', color: '#F97316' },
  { id: 'red', name: 'Red', color: '#DC2626' },
  { id: 'yellow', name: 'Yellow', color: '#FACC15' },
  { id: 'green', name: 'Green', color: '#16A34A' },
  { id: 'darkblue', name: 'Dark blue', color: '#1E3A8A' },
];

let n = 0;
const id = () => `s${n++}`;

const prop = (name: string, group: string, price: number, houseCost: number, rents: number[]): Space => ({
  id: id(),
  name,
  type: 'property',
  group,
  price,
  houseCost,
  rents,
  mortgage: price / 2,
});
const station = (name: string): Space => ({ id: id(), name, type: 'station', price: 200, mortgage: 100, rents: [25, 50, 100, 200] });
const utility = (name: string): Space => ({ id: id(), name, type: 'utility', price: 150, mortgage: 75, rents: [4, 10] });
const card = (name: string, deck: 'chance' | 'chest'): Space => ({ id: id(), name, type: 'card', deck });
const tax = (name: string, amount: number): Space => ({ id: id(), name, type: 'tax', amount });
const corner = (name: string, type: Space['type']): Space => ({ id: id(), name, type });

function spaces(): Space[] {
  n = 0;
  return [
    corner('GO', 'go'),
    prop('Mill Lane', 'brown', 60, 50, [2, 10, 30, 90, 160, 250]),
    card('Chest', 'chest'),
    prop('Kiln Road', 'brown', 60, 50, [4, 20, 60, 180, 320, 450]),
    tax('Income Tax', 200),
    station('North Station'),
    prop('Cedar Park', 'lightblue', 100, 50, [6, 30, 90, 270, 400, 550]),
    card('Chance', 'chance'),
    prop('Elm Row', 'lightblue', 100, 50, [6, 30, 90, 270, 400, 550]),
    prop('Ash Grove', 'lightblue', 120, 50, [8, 40, 100, 300, 450, 600]),
    corner('Jail / Just visiting', 'jail'),
    prop('Rose Avenue', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]),
    utility('Power Company'),
    prop('Lily Street', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]),
    prop('Tulip Way', 'pink', 160, 100, [12, 60, 180, 500, 700, 900]),
    station('East Station'),
    prop('Harbor Road', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]),
    card('Chest', 'chest'),
    prop('Bay Street', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]),
    prop('Dock Lane', 'orange', 200, 100, [16, 80, 220, 600, 800, 1000]),
    corner('Free Parking', 'freeParking'),
    prop('Ember Road', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]),
    card('Chance', 'chance'),
    prop('Flame Street', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]),
    prop('Forge Square', 'red', 240, 150, [20, 100, 300, 750, 925, 1100]),
    station('South Station'),
    prop('Sun Lane', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]),
    prop('Gold Road', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]),
    utility('Water Works'),
    prop('Honey Gardens', 'yellow', 280, 150, [24, 120, 360, 850, 1025, 1200]),
    corner('Go To Jail', 'goToJail'),
    prop('Oak Avenue', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]),
    prop('Pine Street', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]),
    card('Chest', 'chest'),
    prop('Fern Boulevard', 'green', 320, 200, [28, 150, 450, 1000, 1200, 1400]),
    station('West Station'),
    card('Chance', 'chance'),
    prop('Royal Court', 'darkblue', 350, 200, [35, 175, 500, 1100, 1300, 1500]),
    tax('Luxury Tax', 100),
    prop('Crown Plaza', 'darkblue', 400, 200, [50, 200, 600, 1400, 1700, 2000]),
  ];
}

function numbered(deck: string, cards: Omit<Card, 'id' | 'no'>[]): Card[] {
  return cards.map((c, i) => ({ ...c, id: `${deck}${i + 1}`, no: i + 1 }));
}

const chance = (): Card[] =>
  numbered('c', [
    { text: 'Advance to GO', action: 'moveTo', target: 0, collectGo: true },
    { text: 'Advance to Crown Plaza', action: 'moveTo', target: 39, collectGo: true },
    { text: 'Advance to Ember Road', action: 'moveTo', target: 21, collectGo: true },
    { text: 'Advance to Rose Avenue', action: 'moveTo', target: 11, collectGo: true },
    { text: 'Take a trip to North Station', action: 'moveTo', target: 5, collectGo: true },
    { text: 'Go to the nearest station, pay double rent', action: 'nearest', nearest: 'station', multiplier: 2, collectGo: true },
    { text: 'Go to the nearest station, pay double rent', action: 'nearest', nearest: 'station', multiplier: 2, collectGo: true },
    { text: 'Go to the nearest utility, pay 10× dice', action: 'nearest', nearest: 'utility', multiplier: 10, collectGo: true },
    { text: 'Bank pays you a dividend', action: 'collect', amount: 50 },
    { text: 'Get out of jail free', action: 'jailFree' },
    { text: 'Go back 3 spaces', action: 'moveBy', steps: -3 },
    { text: 'Go to jail', action: 'jail' },
    { text: 'General repairs on your buildings', action: 'repairs', perHouse: 25, perHotel: 100 },
    { text: 'Speeding fine', action: 'pay', amount: 15 },
    { text: 'Elected chairperson, pay each player', action: 'payEach', amount: 50 },
    { text: 'Your building loan matures', action: 'collect', amount: 150 },
  ]);

const chest = (): Card[] =>
  numbered('k', [
    { text: 'Advance to GO', action: 'moveTo', target: 0, collectGo: true },
    { text: 'Bank error in your favour', action: 'collect', amount: 200 },
    { text: "Doctor's fee", action: 'pay', amount: 50 },
    { text: 'From sale of stock you get', action: 'collect', amount: 50 },
    { text: 'Get out of jail free', action: 'jailFree' },
    { text: 'Go to jail', action: 'jail' },
    { text: 'Holiday fund matures', action: 'collect', amount: 100 },
    { text: 'Income tax refund', action: 'collect', amount: 20 },
    { text: "It's your birthday, collect from each player", action: 'collectEach', amount: 10 },
    { text: 'Life insurance matures', action: 'collect', amount: 100 },
    { text: 'Hospital fees', action: 'pay', amount: 100 },
    { text: 'School fees', action: 'pay', amount: 50 },
    { text: 'Consultancy fee', action: 'collect', amount: 25 },
    { text: 'Street repairs', action: 'repairs', perHouse: 40, perHotel: 115 },
    { text: 'Second prize in a beauty contest', action: 'collect', amount: 10 },
    { text: 'You inherit', action: 'collect', amount: 100 },
  ]);

export const CLASSIC_ID = 'classic';

export function classicBoard(): Board {
  return {
    id: CLASSIC_ID,
    name: 'Classic-style',
    groups: groups.map((g) => ({ ...g })),
    spaces: spaces(),
    decks: { chance: chance(), chest: chest() },
    deckNames: { chance: 'Chance', chest: 'Chest' },
    rules: {
      startingCash: 1500,
      goSalary: 200,
      jailFine: 50,
      maxJailTurns: 3,
      houses: 32,
      hotels: 12,
      doubleRentOnSet: true,
      auctions: true,
      freeParkingJackpot: false,
      mortgageInterest: 10,
    },
    updatedAt: Date.now(),
  };
}
