export type ChamberEventType =
  | 'DOCUMENT_UPLOADED'
  | 'FACT_EXTRACTED'
  | 'TIMELINE_UPDATED'
  | 'CONTRADICTION_DETECTED'
  | 'WORKFLOW_TRIGGERED'
  | 'AI_MEMORY_UPDATED'
  | 'EVIDENCE_SCORED'
  | 'RESEARCH_COMPLETED'
  | 'DRAFT_GENERATED'
  | 'HEARING_SCHEDULED'
  | 'AUDIT_LOGGED';

export interface ChamberEventPayload {
  id: string;
  type: ChamberEventType;
  matterId?: string;
  actorEmail?: string;
  data: any;
  timestamp: string;
}

type EventCallback = (event: ChamberEventPayload) => void;

class EnterpriseEventBus {
  private subscribers: Map<ChamberEventType, Set<EventCallback>> = new Map();
  private globalSubscribers: Set<EventCallback> = new Set();
  private eventHistory: ChamberEventPayload[] = [];

  public subscribe(eventType: ChamberEventType, callback: EventCallback): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(callback);

    return () => {
      this.subscribers.get(eventType)?.delete(callback);
    };
  }

  public subscribeAll(callback: EventCallback): () => void {
    this.globalSubscribers.add(callback);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }

  public publish(type: ChamberEventType, data: any, matterId?: string, actorEmail: string = 'system@advocate360.ai'): ChamberEventPayload {
    const payload: ChamberEventPayload = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      matterId,
      actorEmail,
      data,
      timestamp: new Date().toISOString()
    };

    this.eventHistory.unshift(payload);
    if (this.eventHistory.length > 200) {
      this.eventHistory.pop();
    }

    // Trigger subscribers
    const typeSubscribers = this.subscribers.get(type);
    if (typeSubscribers) {
      typeSubscribers.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error executing subscriber for event ${type}:`, err);
        }
      });
    }

    this.globalSubscribers.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Error executing global subscriber for event ${type}:`, err);
      }
    });

    return payload;
  }

  public getHistory(): ChamberEventPayload[] {
    return [...this.eventHistory];
  }
}

export const eventBus = new EnterpriseEventBus();
