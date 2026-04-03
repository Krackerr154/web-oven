import posthog from 'posthog-js';

type TrackEventName =
    | 'booking_initiated'
    | 'booking_submitted'
    | 'booking_abandoned'
    | 'form_validation_error'
    | 'instrument_viewed'
    | 'admin_dashboard_viewed'
    | 'cpd_mode_selected';

export function trackEvent(eventName: TrackEventName, properties?: Record<string, any>) {
    if (typeof window !== 'undefined') {
        posthog.capture(eventName, properties);
    }
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
    if (typeof window !== 'undefined') {
        posthog.identify(userId, properties);
    }
}
