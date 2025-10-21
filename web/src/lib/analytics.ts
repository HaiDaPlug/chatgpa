// src/lib/analytics.ts
// Analytics stub for future integration (PostHog, Mixpanel, etc.)

type EventName =
  | 'waitlist_join'
  | 'chat_sent'
  | 'checkout_started'
  | 'subscription_created'
  | 'page_view';

type EventProperties = Record<string, any>;

class Analytics {
  private enabled: boolean;

  constructor() {
    // Only enable analytics in production
    this.enabled = import.meta.env.PROD;
  }

  event(name: EventName, properties?: EventProperties) {
    if (!this.enabled) {
      console.log(`[Analytics] ${name}`, properties);
      return;
    }

    // TODO: Integrate real analytics provider
    // Example: posthog.capture(name, properties);
    console.log(`[Analytics] ${name}`, properties);
  }

  identify(userId: string, traits?: EventProperties) {
    if (!this.enabled) {
      console.log(`[Analytics] identify:`, userId, traits);
      return;
    }

    // TODO: Integrate real analytics provider
    // Example: posthog.identify(userId, traits);
    console.log(`[Analytics] identify:`, userId, traits);
  }

  page(name?: string, properties?: EventProperties) {
    if (!this.enabled) {
      console.log(`[Analytics] page:`, name, properties);
      return;
    }

    // TODO: Integrate real analytics provider
    // Example: posthog.capture('$pageview', { ...properties, page: name });
    console.log(`[Analytics] page:`, name, properties);
  }
}

export const analytics = new Analytics();
