export interface GameEvent {
  id: string;
  title: string;
  message: string;
  type: 'good' | 'bad' | 'neutral';
  effect?: () => void;
  choices?: Array<{ text: string; effect: () => void }>;
}

export class EventSystem {
  private eventQueue: GameEvent[] = [];
  private lastEventTime = 0;
  private eventCooldown = 30000; // 30 seconds between events

  constructor(private onEventCallback: (event: GameEvent) => void) {}

  public tick(): void {
    const now = Date.now();
    if (now - this.lastEventTime < this.eventCooldown) return;

    // Random chance of event
    if (Math.random() < 0.1) {
      // 10% chance per tick
      this.triggerRandomEvent();
      this.lastEventTime = now;
    }
  }

  private triggerRandomEvent(): void {
    const events: GameEvent[] = [
      {
        id: 'blizzard',
        title: 'BLIZZARD WARNING',
        message: 'A harsh winter storm approaches. Power consumption increases by 50%.',
        type: 'bad',
      },
      {
        id: 'harvest',
        title: 'BOUNTIFUL HARVEST',
        message: 'The kolkhoz reports record potato yields! +200 food.',
        type: 'good',
      },
      {
        id: 'inspection',
        title: 'KGB INSPECTION',
        message:
          'State inspectors are coming. Keep everything running smoothly or face consequences.',
        type: 'neutral',
      },
      {
        id: 'defection',
        title: 'DEFECTION ATTEMPT',
        message: '5 citizens tried to flee to the West. They have been... relocated.',
        type: 'bad',
      },
      {
        id: 'propaganda',
        title: 'PROPAGANDA SUCCESS',
        message: 'State radio broadcasts boost morale. Population growth increased!',
        type: 'good',
      },
      {
        id: 'shortage',
        title: 'COAL SHORTAGE',
        message: 'Coal supplies are running low. Power plants operating at 75% capacity.',
        type: 'bad',
      },
      {
        id: 'vodka_demand',
        title: 'VODKA SHORTAGE',
        message:
          'The people demand more vodka! Produce more or face civil unrest. -50 Rubles penalty.',
        type: 'bad',
      },
      {
        id: 'award',
        title: 'HERO OF SOVIET LABOR',
        message:
          'Your excellent management has been recognized! +500 Rubles award. (Actually tin.)',
        type: 'good',
      },
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    this.onEventCallback(event);
  }

  public triggerEvent(eventId: string): void {
    // Manual event triggering for scripted scenarios
    const event = this.getEventById(eventId);
    if (event) {
      this.onEventCallback(event);
    }
  }

  private getEventById(id: string): GameEvent | null {
    // Return predefined events by ID
    return null; // Implement as needed
  }
}
